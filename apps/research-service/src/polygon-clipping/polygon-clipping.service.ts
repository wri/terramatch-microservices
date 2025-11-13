import { Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { PolygonGeometry, SitePolygon, CriteriaSite, Site } from "@terramatch-microservices/database/entities";
import { QueryTypes, Transaction } from "sequelize";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { simplify } from "@turf/simplify";
import { polygon as turfPolygon, multiPolygon as turfMultiPolygon } from "@turf/helpers";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { SitePolygonCreationService } from "../site-polygons/site-polygon-creation.service";
import { CreateSitePolygonRequestDto } from "../site-polygons/dto/create-site-polygon-request.dto";

interface OverlapInfo {
  polyUuid: string;
  polyName: string;
  percentage: number;
  intersectionArea: number;
}

interface ClippedPolygonResult {
  polyUuid: string;
  polyName: string;
  geometry: Polygon | MultiPolygon;
  originalArea: number;
  newArea: number;
  areaRemoved: number;
}

export interface ClippedVersionResult {
  uuid: string;
  polyName: string | null;
  originalArea: number;
  newArea: number;
  areaRemoved: number;
}

const MAX_OVERLAP_PERCENTAGE = 3.5;
const MAX_OVERLAP_AREA_HECTARES = 0.118;
const BUFFER_DISTANCE = 0.000001;
const OVERLAPPING_CRITERIA_ID = VALIDATION_CRITERIA_IDS.OVERLAPPING;

@Injectable()
export class PolygonClippingService {
  private readonly logger = new Logger(PolygonClippingService.name);

  constructor(private readonly sitePolygonCreationService: SitePolygonCreationService) {}

  async getFixablePolygonsForSite(siteUuid: string): Promise<string[]> {
    const site = await Site.findOne({ where: { uuid: siteUuid } });

    if (site == null) {
      throw new NotFoundException(`Site not found: ${siteUuid}`);
    }

    const sitePolygons = await SitePolygon.findAll({
      where: { siteUuid, isActive: true },
      attributes: ["polygonUuid"]
    });

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid).filter(isNotNull);

    if (polygonUuids.length === 0) {
      return [];
    }

    return this.filterFixablePolygons(polygonUuids);
  }

  async getFixablePolygonsForProjectBySite(siteUuid: string): Promise<string[]> {
    const site = await Site.findOne({
      where: { uuid: siteUuid },
      attributes: ["projectId"]
    });

    if (site == null || site.projectId == null) {
      throw new NotFoundException(`Project not found for site: ${siteUuid}`);
    }

    const projectSites = await Site.findAll({
      where: { projectId: site.projectId },
      attributes: ["uuid"]
    });

    const siteUuids = projectSites.map(s => s.uuid);

    const sitePolygons = await SitePolygon.findAll({
      where: { siteUuid: siteUuids, isActive: true },
      attributes: ["polygonUuid"]
    });

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid).filter(isNotNull);

    if (polygonUuids.length === 0) {
      return [];
    }

    return this.filterFixablePolygons(polygonUuids);
  }

  private async filterFixablePolygons(polygonUuids: string[]): Promise<string[]> {
    if (polygonUuids.length === 0) {
      return [];
    }

    const criteriaRecords = await CriteriaSite.findAll({
      where: {
        polygonId: polygonUuids,
        criteriaId: OVERLAPPING_CRITERIA_ID,
        valid: false
      },
      attributes: ["polygonId", "extraInfo"]
    });

    const fixablePolygonSet = new Set<string>();

    for (const record of criteriaRecords) {
      if (record.extraInfo == null || !Array.isArray(record.extraInfo)) {
        continue;
      }

      const overlaps = record.extraInfo as OverlapInfo[];

      for (const overlap of overlaps) {
        const isFixable =
          overlap.percentage <= MAX_OVERLAP_PERCENTAGE &&
          overlap.intersectionArea <= MAX_OVERLAP_AREA_HECTARES &&
          overlap.polyUuid != null;

        if (isFixable) {
          fixablePolygonSet.add(record.polygonId);
          fixablePolygonSet.add(overlap.polyUuid);
        }
      }
    }

    return Array.from(fixablePolygonSet);
  }

  filterFixablePolygonsFromList(polygonUuids: string[]): Promise<string[]> {
    return this.filterFixablePolygons(polygonUuids);
  }

  async clipPolygons(polygonUuids: string[]): Promise<ClippedPolygonResult[]> {
    if (polygonUuids.length === 0) {
      this.logger.warn("No polygons provided for clipping");
      return [];
    }

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const transaction = await PolygonGeometry.sequelize.transaction();

    try {
      const fixableOverlapPairs = await this.getFixableOverlapPairs(polygonUuids);

      if (fixableOverlapPairs.length === 0) {
        this.logger.log("No fixable overlap pairs found in criteria_site data");
        await transaction.rollback();
        return [];
      }

      this.logger.log(`Found ${fixableOverlapPairs.length} fixable overlap pairs to process`);

      const polygons = await this.getPolygonsWithGeometry(polygonUuids, transaction);

      if (polygons.size === 0) {
        await transaction.rollback();
        return [];
      }

      const clippedResults = await this.processFixableOverlaps(fixableOverlapPairs, polygons, transaction);

      await transaction.commit();

      this.logger.log(`Successfully clipped ${clippedResults.length} polygons`);

      return clippedResults;
    } catch (error) {
      await transaction.rollback();
      this.logger.error("Error clipping polygons", error);
      throw new InternalServerErrorException("Failed to clip polygons");
    }
  }

  private async getFixableOverlapPairs(
    polygonUuids: string[]
  ): Promise<Array<{ polygon1Uuid: string; polygon2Uuid: string; intersectionArea: number }>> {
    if (polygonUuids.length === 0) {
      return [];
    }

    const criteriaRecords = await CriteriaSite.findAll({
      where: {
        polygonId: polygonUuids,
        criteriaId: OVERLAPPING_CRITERIA_ID,
        valid: false
      },
      attributes: ["polygonId", "extraInfo"]
    });

    const pairs: Array<{ polygon1Uuid: string; polygon2Uuid: string; intersectionArea: number }> = [];
    const processedPairs = new Set<string>();

    for (const record of criteriaRecords) {
      if (record.extraInfo == null || !Array.isArray(record.extraInfo)) {
        continue;
      }

      const overlaps = record.extraInfo as OverlapInfo[];

      for (const overlap of overlaps) {
        const isFixable =
          overlap.percentage <= MAX_OVERLAP_PERCENTAGE &&
          overlap.intersectionArea <= MAX_OVERLAP_AREA_HECTARES &&
          overlap.polyUuid != null;

        if (isFixable) {
          const pairKey = [record.polygonId, overlap.polyUuid].sort().join("-");

          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            pairs.push({
              polygon1Uuid: record.polygonId,
              polygon2Uuid: overlap.polyUuid,
              intersectionArea: overlap.intersectionArea
            });
          }
        }
      }
    }

    return pairs;
  }

  private async getPolygonsWithGeometry(
    polygonUuids: string[],
    transaction: Transaction
  ): Promise<Map<string, { uuid: string; name: string; area: number; geojson: string }>> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const placeholders = polygonUuids.map((_, i) => `:uuid${i}`).join(",");
    const replacements: Record<string, string> = {};
    polygonUuids.forEach((uuid, i) => {
      replacements[`uuid${i}`] = uuid;
    });

    const query = `
      SELECT
        pg.uuid,
        COALESCE(sp.poly_name, 'Unnamed') as name,
        ST_Area(pg.geom) as area,
        ST_AsGeoJSON(pg.geom) as geojson
      FROM polygon_geometry pg
      LEFT JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
      WHERE pg.uuid IN (${placeholders})
        AND pg.deleted_at IS NULL
    `;

    const results = (await PolygonGeometry.sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
      transaction
    })) as Array<{ uuid: string; name: string; area: number; geojson: string }>;

    const polygonMap = new Map();
    for (const result of results) {
      polygonMap.set(result.uuid, result);
    }

    return polygonMap;
  }

  private async processFixableOverlaps(
    overlapPairs: Array<{ polygon1Uuid: string; polygon2Uuid: string; intersectionArea: number }>,
    polygonMap: Map<string, { uuid: string; name: string; area: number; geojson: string }>,
    transaction: Transaction
  ): Promise<ClippedPolygonResult[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const polygonOverlaps = new Map<string, Set<string>>();
    const totalAreaRemoved = new Map<string, number>();

    for (const pair of overlapPairs) {
      const polygon1 = polygonMap.get(pair.polygon1Uuid);
      const polygon2 = polygonMap.get(pair.polygon2Uuid);

      if (polygon1 == null || polygon2 == null) {
        this.logger.warn(`Polygon data not found for pair: ${pair.polygon1Uuid} <-> ${pair.polygon2Uuid}`);
        continue;
      }

      const largerUuid = polygon1.area >= polygon2.area ? pair.polygon1Uuid : pair.polygon2Uuid;
      const smallerUuid = polygon1.area < polygon2.area ? pair.polygon1Uuid : pair.polygon2Uuid;

      if (!polygonOverlaps.has(largerUuid)) {
        polygonOverlaps.set(largerUuid, new Set());
        totalAreaRemoved.set(largerUuid, 0);
      }

      polygonOverlaps.get(largerUuid)?.add(smallerUuid);
      totalAreaRemoved.set(largerUuid, (totalAreaRemoved.get(largerUuid) ?? 0) + pair.intersectionArea);
    }

    const clippedResults: ClippedPolygonResult[] = [];

    for (const [largerUuid, smallerUuids] of polygonOverlaps.entries()) {
      const smallerUuidsArray = Array.from(smallerUuids);

      const clippedGeometry = await this.clipPolygonGeometryMultiple(largerUuid, smallerUuidsArray, transaction);

      if (clippedGeometry != null) {
        const largerPolygon = polygonMap.get(largerUuid);
        const largerPolygonGeom = JSON.parse(largerPolygon?.geojson ?? "{}");
        const latitude = this.getApproxLatitude(largerPolygonGeom);

        const originalAreaHa = this.convertSquareDegreesToHectares(largerPolygon?.area ?? 0, latitude);
        const areaRemoved = totalAreaRemoved.get(largerUuid) ?? 0;

        clippedResults.push({
          polyUuid: largerUuid,
          polyName: largerPolygon?.name ?? "Unnamed",
          geometry: clippedGeometry,
          originalArea: originalAreaHa,
          newArea: originalAreaHa - areaRemoved,
          areaRemoved: areaRemoved
        });
      }
    }

    return clippedResults;
  }

  private getApproxLatitude(geometry: Polygon | MultiPolygon): number {
    try {
      if (geometry.type === "Polygon") {
        const coords = geometry.coordinates[0][0];
        return coords[1];
      } else if (geometry.type === "MultiPolygon") {
        const coords = geometry.coordinates[0][0][0];
        return coords[1];
      }
    } catch (error) {
      this.logger.warn("Could not extract latitude from geometry, using default 0", error);
    }
    return 0;
  }

  private async clipPolygonGeometryMultiple(
    largerUuid: string,
    smallerUuids: string[],
    transaction: Transaction
  ): Promise<Polygon | MultiPolygon | null> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    try {
      let currentGeometry: Polygon | MultiPolygon | null = null;

      for (let i = 0; i < smallerUuids.length; i++) {
        const smallerUuid = smallerUuids[i];

        const query =
          i === 0
            ? `
            SELECT ST_AsGeoJSON(
              ST_Difference(
                larger.geom,
                ST_Buffer(smaller.geom, :bufferDistance)
              )
            ) as clipped_geojson
            FROM polygon_geometry larger
            CROSS JOIN polygon_geometry smaller
            WHERE larger.uuid = :largerUuid
              AND smaller.uuid = :smallerUuid
              AND larger.deleted_at IS NULL
              AND smaller.deleted_at IS NULL
          `
            : `
            SELECT ST_AsGeoJSON(
              ST_Difference(
                ST_GeomFromGeoJSON(:currentGeom),
                ST_Buffer(smaller.geom, :bufferDistance)
              )
            ) as clipped_geojson
            FROM polygon_geometry smaller
            WHERE smaller.uuid = :smallerUuid
              AND smaller.deleted_at IS NULL
          `;

        const replacements: Record<string, string> = {
          bufferDistance: BUFFER_DISTANCE.toString(),
          smallerUuid
        };

        if (i === 0) {
          replacements.largerUuid = largerUuid;
        } else {
          replacements.currentGeom = JSON.stringify(currentGeometry);
        }

        const results = (await PolygonGeometry.sequelize.query(query, {
          replacements,
          type: QueryTypes.SELECT,
          transaction
        })) as Array<{ clipped_geojson: string }>;

        if (results.length === 0 || results[0].clipped_geojson == null) {
          this.logger.warn(`No clipped geometry returned for ${largerUuid} at iteration ${i + 1}`);
          return null;
        }

        const parsedGeometry = JSON.parse(results[0].clipped_geojson);

        if (parsedGeometry == null) {
          this.logger.error(`Null geometry returned at iteration ${i + 1}`);
          return null;
        }

        const geomType = parsedGeometry.type;
        if (geomType !== "Polygon" && geomType !== "MultiPolygon") {
          this.logger.error(`Invalid geometry type after clipping at iteration ${i + 1}: ${geomType}`);
          return null;
        }

        currentGeometry = parsedGeometry as Polygon | MultiPolygon;
      }

      if (currentGeometry != null) {
        currentGeometry = this.simplifyGeometry(currentGeometry);
      }

      return currentGeometry;
    } catch (error) {
      this.logger.error(`Error clipping polygon ${largerUuid}`, error);
      return null;
    }
  }

  private simplifyGeometry(geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
    try {
      // This removes only the tiny buffer curves, not important geometry features
      const tolerance = 0.0000005;
      const highQuality = true;

      let turfFeature;
      if (geometry.type === "Polygon") {
        turfFeature = turfPolygon(geometry.coordinates);
      } else {
        turfFeature = turfMultiPolygon(geometry.coordinates);
      }

      const simplified = simplify(turfFeature, { tolerance, highQuality });

      return simplified.geometry as Polygon | MultiPolygon;
    } catch (error) {
      this.logger.warn("Could not simplify geometry, returning original", error);
      return geometry;
    }
  }

  private convertSquareDegreesToHectares(squareDegrees: number, latitude: number): number {
    const metersPerDegree = 111320;
    const latitudeFactor = Math.cos((latitude * Math.PI) / 180);
    const squareMeters = squareDegrees * metersPerDegree * metersPerDegree * latitudeFactor;
    return squareMeters / 10000;
  }

  buildGeoJsonResponse(clippedResults: ClippedPolygonResult[]): FeatureCollection<Polygon | MultiPolygon> {
    const features: Feature<Polygon | MultiPolygon>[] = clippedResults.map(result => ({
      type: "Feature",
      properties: {
        poly_id: result.polyUuid,
        poly_name: result.polyName,
        original_area_ha: result.originalArea,
        new_area_ha: result.newArea,
        area_removed_ha: result.areaRemoved
      },
      geometry: result.geometry
    }));

    return {
      type: "FeatureCollection",
      features
    };
  }

  async getOriginalGeometriesGeoJson(polygonUuids: string[]): Promise<FeatureCollection<Polygon | MultiPolygon>> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const placeholders = polygonUuids.map((_, i) => `:uuid${i}`).join(",");
    const replacements: Record<string, string> = {};
    polygonUuids.forEach((uuid, i) => {
      replacements[`uuid${i}`] = uuid;
    });

    const query = `
      SELECT
        pg.uuid,
        COALESCE(sp.poly_name, 'Unnamed') as name,
        ST_AsGeoJSON(pg.geom) as geojson
      FROM polygon_geometry pg
      LEFT JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
      WHERE pg.uuid IN (${placeholders})
        AND pg.deleted_at IS NULL
    `;

    const results = (await PolygonGeometry.sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })) as Array<{ uuid: string; name: string; geojson: string }>;

    const features: Feature<Polygon | MultiPolygon>[] = results.map(result => ({
      type: "Feature",
      properties: {
        poly_id: result.uuid,
        poly_name: result.name
      },
      geometry: JSON.parse(result.geojson)
    }));

    return {
      type: "FeatureCollection",
      features
    };
  }

  async clipAndCreateVersions(
    polygonUuids: string[],
    userId: number,
    userFullName: string | null,
    source: string
  ): Promise<ClippedVersionResult[]> {
    if (polygonUuids.length === 0) {
      this.logger.warn("No polygons provided for clipping and versioning");
      return [];
    }

    if (SitePolygon.sequelize == null) {
      throw new InternalServerErrorException("SitePolygon model is missing sequelize connection");
    }

    const clippedResults = await this.clipPolygons(polygonUuids);

    if (clippedResults.length === 0) {
      this.logger.log("No fixable overlaps found for the provided polygons");
      return [];
    }

    this.logger.log(`Creating versions for ${clippedResults.length} clipped polygons`);

    const baseSitePolygons = await SitePolygon.findAll({
      where: {
        polygonUuid: clippedResults.map(r => r.polyUuid),
        isActive: true
      }
    });

    const polygonUuidToSitePolygon = new Map<string, SitePolygon>();
    for (const sp of baseSitePolygons) {
      if (sp.polygonUuid != null) {
        polygonUuidToSitePolygon.set(sp.polygonUuid, sp);
      }
    }

    const BATCH_SIZE = 10;
    const results: ClippedVersionResult[] = [];

    for (let i = 0; i < clippedResults.length; i += BATCH_SIZE) {
      const batch = clippedResults.slice(i, i + BATCH_SIZE);

      await SitePolygon.sequelize.transaction(async transaction => {
        for (const clippedResult of batch) {
          const baseSitePolygon = polygonUuidToSitePolygon.get(clippedResult.polyUuid);

          if (baseSitePolygon == null) {
            this.logger.warn(`No active site polygon found for polygon UUID ${clippedResult.polyUuid}`);
            continue;
          }

          try {
            const changeReason = `Clipped due to overlap, area reduced from ${clippedResult.originalArea.toFixed(
              4
            )}ha to ${clippedResult.newArea.toFixed(4)}ha`;

            const newGeometry: CreateSitePolygonRequestDto[] = [
              {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: clippedResult.geometry,
                    properties: {
                      site_id: baseSitePolygon.siteUuid
                    }
                  }
                ]
              }
            ];

            const newVersion = await this.sitePolygonCreationService.createSitePolygonVersion(
              baseSitePolygon.uuid,
              newGeometry,
              undefined, // No attribute changes
              changeReason,
              userId,
              userFullName,
              source,
              transaction
            );

            results.push({
              uuid: newVersion.uuid,
              polyName: newVersion.polyName,
              originalArea: clippedResult.originalArea,
              newArea: clippedResult.newArea,
              areaRemoved: clippedResult.areaRemoved
            });

            this.logger.log(`Created version ${newVersion.uuid} for polygon ${baseSitePolygon.uuid}`);
          } catch (error) {
            this.logger.error(`Failed to create version for polygon ${baseSitePolygon.uuid}`, error);
          }
        }
      });
    }

    this.logger.log(`Successfully created ${results.length} polygon versions`);
    return results;
  }
}
