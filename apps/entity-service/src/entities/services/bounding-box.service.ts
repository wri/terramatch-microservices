import { Injectable, NotFoundException } from "@nestjs/common";
import { BoundingBoxDto } from "../dto/bounding-box.dto";
import {
  LandscapeGeometry,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { Model, ModelStatic, Op, Sequelize, WhereOptions } from "sequelize";
import { BadRequestException } from "@nestjs/common";

enum EntityType {
  POLYGON = "Polygon",
  SITE = "Site",
  PROJECT = "Project",
  LANDSCAPE = "Landscape"
}

interface BoundingBoxCoordinates {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

@Injectable()
export class BoundingBoxService {
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
      const errorMsg = identifier
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

    if (!site) {
      throw new NotFoundException(`${EntityType.SITE} with UUID ${siteUuid} not found`);
    }

    const sitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid,
        polygonUuid: { [Op.ne]: null },
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

    if (!project) {
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
        polygonUuid: { [Op.ne]: null }
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
    if (!landscapes || landscapes.length === 0) {
      throw new BadRequestException("At least one landscape slug is required");
    }
    // TODO: Add country geometry model to obtain the bounding box of the country
    return this.getBoundingBoxFromGeometries(
      LandscapeGeometry,
      { slug: { [Op.in]: landscapes } },
      "geometry",
      EntityType.LANDSCAPE
    );
  }
}
