import { Injectable, NotFoundException } from "@nestjs/common";
import { BoundingBoxDto } from "../dto/bounding-box.dto";
import {
  LandscapeGeometry,
  PointGeometry,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { Op, Sequelize, fn, col, literal, QueryTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { BadRequestException } from "@nestjs/common";

@Injectable()
export class BoundingBoxService {
  /**
   * Creates a new BoundingBoxDto with the specified coordinates
   */
  private createBoundingBoxDto(minLng: number, minLat: number, maxLng: number, maxLat: number): BoundingBoxDto {
    return new BoundingBoxDto({
      bbox: [minLng, minLat, maxLng, maxLat]
    });
  }

  /**
   * Get bounding box for a single polygon by UUID
   */
  async getPolygonBoundingBox(polygonUuid: string): Promise<BoundingBoxDto> {
    const polygon = await PolygonGeometry.findOne({
      where: { uuid: polygonUuid },
      attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
    });

    if (!polygon) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const geojson = JSON.parse(polygon.get("envelope") as string);
    const coordinates = geojson.coordinates[0];

    let maxLng = -Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let minLat = Infinity;

    for (const point of coordinates) {
      const [lng, lat] = point;
      maxLng = Math.max(maxLng, lng);
      minLng = Math.min(minLng, lng);
      maxLat = Math.max(maxLat, lat);
      minLat = Math.min(minLat, lat);
    }

    if (!polygon) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    return this.createBoundingBoxDto(minLng, minLat, maxLng, maxLat);
  }

  /**
   * Get bounding box for all polygons of a site by site UUID
   */
  async getSiteBoundingBox(siteUuid: string): Promise<BoundingBoxDto> {
    const site = await Site.findOne({ where: { uuid: siteUuid } });

    if (!site) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    // Get all site polygon UUIDs
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

    // Get envelopes for each polygon individually instead of using ST_UNION
    const envelopes = await PolygonGeometry.findAll({
      where: {
        uuid: { [Op.in]: polygonUuids }
      },
      attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
    });

    if (envelopes.length === 0) {
      throw new NotFoundException(`Could not calculate bounding box for site with UUID ${siteUuid}`);
    }

    let maxLng = -Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let minLat = Infinity;

    // Process each envelope to find the overall min/max values
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

    return this.createBoundingBoxDto(minLng, minLat, maxLng, maxLat);
  }

  /**
   * Get bounding box for all site polygons of a project by project UUID
   */
  async getProjectBoundingBox(projectUuid: string): Promise<BoundingBoxDto> {
    const project = await Project.findOne({
      where: { uuid: projectUuid },
      attributes: ["id"]
    });

    if (!project) {
      throw new NotFoundException(`Project with UUID ${projectUuid} not found`);
    }

    // First get all sites for this project
    const sites = await Site.findAll({
      where: { projectId: project.id },
      attributes: ["uuid"]
    });

    if (sites.length === 0) {
      throw new NotFoundException(`No sites found for project with UUID ${projectUuid}`);
    }

    const siteUuids = sites.map(site => site.uuid);

    // Get all polygon UUIDs from site polygons
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

    // Get envelopes for each polygon individually instead of using ST_UNION
    const envelopes = await PolygonGeometry.findAll({
      where: {
        uuid: { [Op.in]: polygonUuids }
      },
      attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
    });

    if (envelopes.length === 0) {
      throw new NotFoundException(`Could not calculate bounding box for project with UUID ${projectUuid}`);
    }

    let maxLng = -Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let minLat = Infinity;

    // Process each envelope to find the overall min/max values
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

    return this.createBoundingBoxDto(minLng, minLat, maxLng, maxLat);
  }

  /**
   * Get bounding box for project centroids by array of project UUIDs
   */
  async getProjectsCentroidBoundingBox(projectUuids: string[]): Promise<BoundingBoxDto> {
    if (!projectUuids.length) {
      throw new BadRequestException("At least one project UUID is required");
    }

    const projects = await Project.findAll({
      where: { uuid: { [Op.in]: projectUuids } },
      attributes: ["id"]
    });

    if (projects.length === 0) {
      throw new NotFoundException(`No projects found with the provided UUIDs`);
    }

    const projectIds = projects.map(project => project.id);

    // Get all sites for these projects
    const sites = await Site.findAll({
      where: { projectId: { [Op.in]: projectIds } },
      attributes: ["uuid"]
    });

    if (sites.length === 0) {
      throw new NotFoundException(`No sites found for the provided project UUIDs`);
    }

    const siteUuids = sites.map(site => site.uuid);

    // Get all point UUIDs from site polygons
    const sitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid: { [Op.in]: siteUuids },
        pointUuid: { [Op.ne]: null }
      },
      attributes: ["pointUuid"]
    });

    if (sitePolygons.length === 0) {
      throw new NotFoundException(`No points found for the provided project UUIDs`);
    }

    const pointUuids = sitePolygons.map(sp => sp.pointUuid);

    // Calculate the bounding box of all points (centroids)
    const result = await PointGeometry.findOne({
      where: {
        uuid: { [Op.in]: pointUuids }
      },
      attributes: [
        [Sequelize.fn("MIN", Sequelize.fn("ST_X", Sequelize.col("point"))), "minLng"],
        [Sequelize.fn("MIN", Sequelize.fn("ST_Y", Sequelize.col("point"))), "minLat"],
        [Sequelize.fn("MAX", Sequelize.fn("ST_X", Sequelize.col("point"))), "maxLng"],
        [Sequelize.fn("MAX", Sequelize.fn("ST_Y", Sequelize.col("point"))), "maxLat"]
      ]
    });

    const { minLng, minLat, maxLng, maxLat } = result.get({ plain: true }) as any;
    return this.createBoundingBoxDto(parseFloat(minLng), parseFloat(minLat), parseFloat(maxLng), parseFloat(maxLat));
  }

  /**
   * Get bounding box for a landscape by slug
   */
  async getLandscapeBoundingBox(slug: string): Promise<BoundingBoxDto> {
    const landscape = await LandscapeGeometry.findOne({
      where: { slug },
      attributes: [
        [Sequelize.fn("ST_XMin", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "minLng"],
        [Sequelize.fn("ST_YMin", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "minLat"],
        [Sequelize.fn("ST_XMax", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "maxLng"],
        [Sequelize.fn("ST_YMax", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "maxLat"]
      ]
    });

    if (!landscape) {
      throw new NotFoundException(`Landscape with slug ${slug} not found`);
    }

    const { minLng, minLat, maxLng, maxLat } = landscape.get({ plain: true }) as any;
    return this.createBoundingBoxDto(parseFloat(minLng), parseFloat(minLat), parseFloat(maxLng), parseFloat(maxLat));
  }

  /**
   * Get bounding box for a country-landscape combination
   */
  async getCountryLandscapeBoundingBox(country: string, landscapes: string[]): Promise<BoundingBoxDto> {
    if (!landscapes || landscapes.length === 0) {
      throw new BadRequestException("At least one landscape slug is required");
    }

    // For country part, we'll need to add the country geometry model
    // This is currently referenced as worldcountriesgenerated in the requirements
    // For now, we'll only use landscapes

    const landscapeGeometries = await LandscapeGeometry.findAll({
      where: { slug: { [Op.in]: landscapes } },
      attributes: [
        [
          Sequelize.fn("MIN", Sequelize.fn("ST_XMin", Sequelize.fn("ST_Envelope", Sequelize.col("geometry")))),
          "minLng"
        ],
        [
          Sequelize.fn("MIN", Sequelize.fn("ST_YMin", Sequelize.fn("ST_Envelope", Sequelize.col("geometry")))),
          "minLat"
        ],
        [
          Sequelize.fn("MAX", Sequelize.fn("ST_XMax", Sequelize.fn("ST_Envelope", Sequelize.col("geometry")))),
          "maxLng"
        ],
        [Sequelize.fn("MAX", Sequelize.fn("ST_YMax", Sequelize.fn("ST_Envelope", Sequelize.col("geometry")))), "maxLat"]
      ]
    });

    if (!landscapeGeometries.length) {
      throw new NotFoundException(`No landscapes found with the provided slugs`);
    }

    const { minLng, minLat, maxLng, maxLat } = landscapeGeometries[0].get({ plain: true }) as any;
    return this.createBoundingBoxDto(parseFloat(minLng), parseFloat(minLat), parseFloat(maxLng), parseFloat(maxLat));
  }

  /**
   * Get bounding box for a country by ISO code
   * Note: This requires a WorldCountries entity which isn't yet in the model
   * This is a placeholder that needs to be updated with the real model
   */
  async getCountryBoundingBox(countryIso: string): Promise<BoundingBoxDto> {
    // TODO: Once the WorldCountriesGenerated entity is available, implement this
    // For now, we'll return a mock response
    throw new NotFoundException(
      "Country bounding box lookups not yet implemented - need WorldCountriesGenerated entity"
    );
  }
}
