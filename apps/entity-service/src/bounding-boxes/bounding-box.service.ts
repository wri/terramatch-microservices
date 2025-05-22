import { Injectable, NotFoundException } from "@nestjs/common";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import {
  LandscapeGeometry,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { Model, ModelStatic, Op, Sequelize, WhereOptions } from "sequelize";
import { DataApiService } from "@terramatch-microservices/data-api";
import { ConfigService } from "@nestjs/config";
import { isEmpty } from "lodash";

enum EntityType {
  POLYGON = "Polygon",
  SITE = "Site",
  PROJECT = "Project",
  LANDSCAPE = "Landscape",
  COUNTRY = "Country"
}

interface BoundingBoxCoordinates {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

@Injectable()
export class BoundingBoxService {
  constructor(private readonly dataApiService: DataApiService, private readonly configService: ConfigService) {}

  private createBoundingBoxDto(minLng: number, minLat: number, maxLng: number, maxLat: number): BoundingBoxDto {
    return new BoundingBoxDto({
      bbox: [minLng, minLat, maxLng, maxLat]
    });
  }

  private extractBoundingBoxFromEnvelopes(envelopes: Model[]): BoundingBoxCoordinates {
    let maxLng = -Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let minLat = Infinity;

    for (const envelope of envelopes) {
      const geojson = JSON.parse(envelope.get("envelope") as string);
      const coordinates = geojson.coordinates[0];

      for (const point of coordinates) {
        const [lng, lat] = point;
        maxLng = Math.max(maxLng, lng);
        minLng = Math.min(minLng, lng);
        maxLat = Math.max(maxLat, lat);
        minLat = Math.min(minLat, lat);
      }
    }

    return { minLng, minLat, maxLng, maxLat };
  }

  private async getBoundingBoxFromGeometries<T extends Model>(
    model: ModelStatic<T>,
    whereCondition: WhereOptions,
    geometryColumn: string,
    entityType: EntityType,
    identifier?: string
  ): Promise<BoundingBoxDto> {
    const envelopes = await model.findAll({
      where: whereCondition,
      attributes: [
        [Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col(geometryColumn))), "envelope"]
      ]
    });

    if (envelopes.length === 0) {
      const errorMsg = !isEmpty(identifier)
        ? `No ${entityType.toLowerCase()} found with UUID ${identifier}`
        : `No ${entityType.toLowerCase()} found with the provided criteria`;
      throw new NotFoundException(errorMsg);
    }

    const { minLng, minLat, maxLng, maxLat } = this.extractBoundingBoxFromEnvelopes(envelopes);
    return this.createBoundingBoxDto(minLng, minLat, maxLng, maxLat);
  }

  async getPolygonBoundingBox(polygonUuid: string): Promise<BoundingBoxDto> {
    return this.getBoundingBoxFromGeometries(
      PolygonGeometry,
      { uuid: polygonUuid },
      "geom",
      EntityType.POLYGON,
      polygonUuid
    );
  }

  async getSiteBoundingBox(siteUuid: string): Promise<BoundingBoxDto> {
    const site = await Site.findOne({
      where: { uuid: siteUuid },
      attributes: ["uuid"]
    });

    if (site == null) {
      throw new NotFoundException(`${EntityType.SITE} with UUID ${siteUuid} not found`);
    }

    const sitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid,
        polygonUuid: { [Op.ne]: "" },
        isActive: true,
        deletedAt: null
      },
      attributes: ["polygonUuid"]
    });

    if (sitePolygons.length === 0) {
      throw new NotFoundException(`No polygons found for site with UUID ${siteUuid}`);
    }

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid);

    return this.getBoundingBoxFromGeometries(
      PolygonGeometry,
      { uuid: { [Op.in]: polygonUuids } },
      "geom",
      EntityType.POLYGON
    );
  }

  async getProjectBoundingBox(projectUuid: string): Promise<BoundingBoxDto> {
    const project = await Project.findOne({
      where: { uuid: projectUuid },
      attributes: ["id"]
    });

    if (project == null) {
      throw new NotFoundException(`${EntityType.PROJECT} with UUID ${projectUuid} not found`);
    }

    const sites = await Site.findAll({
      where: { projectId: project.id },
      attributes: ["uuid"]
    });

    if (sites.length === 0) {
      throw new NotFoundException(`No sites found for project with UUID ${projectUuid}`);
    }

    const siteUuids = sites.map(site => site.uuid);

    const sitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid: { [Op.in]: siteUuids },
        polygonUuid: { [Op.ne]: "" }
      },
      attributes: ["polygonUuid"]
    });

    if (sitePolygons.length === 0) {
      throw new NotFoundException(`No polygons found for project with UUID ${projectUuid}`);
    }

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid);

    return this.getBoundingBoxFromGeometries(
      PolygonGeometry,
      { uuid: { [Op.in]: polygonUuids } },
      "geom",
      EntityType.POLYGON
    );
  }

  async getCountryLandscapeBoundingBox(country: string, landscapes: string[]): Promise<BoundingBoxDto> {
    let maxLng = -Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let minLat = Infinity;
    let hasBounds = false;

    // Get bounding box from landscapes if provided
    if (Array.isArray(landscapes) && landscapes.length > 0) {
      try {
        const landscapeBbox = await this.getBoundingBoxFromGeometries(
          LandscapeGeometry,
          { slug: { [Op.in]: landscapes } },
          "geometry",
          EntityType.LANDSCAPE
        );

        // Extract coordinates from landscapes bounding box
        const [west, south, east, north] = landscapeBbox.bbox;
        maxLng = Math.max(maxLng, east);
        minLng = Math.min(minLng, west);
        maxLat = Math.max(maxLat, north);
        minLat = Math.min(minLat, south);
        hasBounds = true;
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }
    if (!isEmpty(country)) {
      try {
        const countryIso = country.toUpperCase();

        try {
          const envelopeData = await this.dataApiService.getCountryEnvelope(countryIso);

          if (
            envelopeData.length > 0 &&
            typeof envelopeData[0] === "object" &&
            envelopeData[0] !== null &&
            "envelope" in envelopeData[0] &&
            typeof envelopeData[0].envelope === "string"
          ) {
            try {
              const geojson = JSON.parse(envelopeData[0].envelope);

              if (
                geojson != null &&
                typeof geojson === "object" &&
                "coordinates" in geojson &&
                geojson.coordinates != null &&
                Array.isArray(geojson.coordinates) &&
                geojson.coordinates.length > 0 &&
                geojson.coordinates[0] != null &&
                Array.isArray(geojson.coordinates[0])
              ) {
                const coordinates = geojson.coordinates[0];

                for (const point of coordinates) {
                  if (Array.isArray(point) && point.length >= 2) {
                    const [lng, lat] = point;
                    if (typeof lng === "number" && typeof lat === "number") {
                      maxLng = Math.max(maxLng, lng);
                      minLng = Math.min(minLng, lng);
                      maxLat = Math.max(maxLat, lat);
                      minLat = Math.min(minLat, lat);
                    }
                  }
                }
                hasBounds = true;
              }
            } catch (jsonParseError) {
              console.error("Error parsing envelope JSON:", jsonParseError);
            }
          }
        } catch (apiError) {
          console.error("Error fetching country envelope:", apiError);
          if (!hasBounds) {
            throw apiError;
          }
        }
      } catch (error) {
        if (!hasBounds) {
          throw error;
        }
      }
    }
    if (!hasBounds) {
      throw new NotFoundException("No valid bounding box found. Please provide valid country code or landscape names.");
    }

    return this.createBoundingBoxDto(minLng, minLat, maxLng, maxLat);
  }
}
