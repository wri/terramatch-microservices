import { Injectable, Logger, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { FeatureCollection, Feature, Polygon, MultiPolygon } from "geojson";
import { makeValid, geometryIntersects, geometryDifference, bufferGeometry } from "./utils/geometry.helper";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";

interface PolygonFeature extends Feature<Polygon | MultiPolygon> {
  properties: {
    poly_id: string;
    poly_name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

interface PolygonData {
  index: number;
  geometry: Polygon | MultiPolygon;
  properties: {
    poly_id: string;
    poly_name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

interface OverlapConditions {
  maxPercentage: number; // 3.5%
  maxAreaHectares: number; // 0.1 hectares (updated from 0.118 to match Python condition)
}

interface IntersectionData {
  targetUuid: string;
  candidateUuid: string;
  targetArea: number;
  candidateArea: number;
  intersectionArea: number;
  intersectionLatitude: number;
}

@Injectable()
export class PolygonClippingService {
  private readonly logger = new Logger(PolygonClippingService.name);
  private readonly BUFFER_DISTANCE = 0.000001; // Small buffer in degrees (same as Python)
  private readonly OVERLAP_CONDITIONS: OverlapConditions = {
    maxPercentage: 3.5,
    maxAreaHectares: 0.1
  };

  /**
   * Get polygon geometries as GeoJSON FeatureCollection
   */
  async getPolygonsGeojson(polygonUuids: string[]): Promise<FeatureCollection<Polygon | MultiPolygon>> {
    const polygonGeometries = await PolygonGeometry.findAll({
      where: { uuid: polygonUuids },
      attributes: ["uuid", "polygon"]
    });

    if (polygonGeometries.length === 0) {
      throw new NotFoundException(`No polygons found for the provided UUIDs`);
    }

    // Get polygon names from SitePolygon
    const sitePolygons = await SitePolygon.findAll({
      where: { polygonUuid: polygonUuids, isActive: true },
      attributes: ["polygonUuid", "polyName"]
    });

    const polygonNameMap = new Map(sitePolygons.map(sp => [sp.polygonUuid, sp.polyName ?? "Unnamed Polygon"]));

    const features: PolygonFeature[] = polygonGeometries.map(pg => ({
      type: "Feature",
      geometry: pg.polygon,
      properties: {
        poly_id: pg.uuid,
        poly_name: polygonNameMap.get(pg.uuid) ?? "Unnamed Polygon"
      }
    }));

    return {
      type: "FeatureCollection",
      features
    };
  }

  /**
   * Process and clip overlapping polygons
   * Replicates the Python script logic using database for accurate area calculations
   */
  async clipPolygons(
    geojson: FeatureCollection<Polygon | MultiPolygon>
  ): Promise<FeatureCollection<Polygon | MultiPolygon>> {
    try {
      // Step 1: Process and validate features
      const origData = this.processFeatures(geojson.features as PolygonFeature[]);

      if (origData.length === 0) {
        this.logger.warn("No valid features to process");
        return { type: "FeatureCollection", features: [] };
      }

      // Step 2: Get accurate intersection data from database
      const polygonUuids = origData.map(d => d.properties.poly_id);
      const intersectionData = await this.getIntersectionDataFromDatabase(polygonUuids);

      // Step 3: Fix overlaps using database intersection data
      const changes = await this.fixOverlapsWithDatabaseData(origData, intersectionData);

      // Step 4: Create output GeoJSON with only modified polygons
      const outputGeojson = this.createOutputGeojson(origData, changes);

      this.logger.log(`Clipped ${Object.keys(changes).length} overlapping polygons`);

      return outputGeojson;
    } catch (error) {
      this.logger.error(`Error clipping polygons: ${error}`);
      throw new InternalServerErrorException("Error processing polygon clipping");
    }
  }

  /**
   * Process features: validate and fix geometries
   */
  private processFeatures(features: PolygonFeature[]): PolygonData[] {
    const origData: PolygonData[] = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const geometry = feature.geometry;

      // Validate geometry using JSTS (similar to Shapely's is_valid)
      const validGeometry = makeValid(geometry);

      if (validGeometry === null) {
        this.logger.warn(`Unable to fix invalid geometry in feature ${i}. Skipping.`);
        continue;
      }

      origData.push({
        index: i,
        geometry: validGeometry as Polygon | MultiPolygon,
        properties: feature.properties
      });
    }

    return origData;
  }

  /**
   * Get accurate intersection data from database using ST_Intersection
   */
  private async getIntersectionDataFromDatabase(polygonUuids: string[]): Promise<IntersectionData[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const transaction = await PolygonGeometry.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    try {
      const intersectionResults = await PolygonGeometry.checkGeometryIntersections(
        polygonUuids,
        polygonUuids,
        transaction
      );

      await transaction.commit();

      return intersectionResults.filter(
        result => result.targetUuid !== result.candidateUuid && result.intersectionArea > 1e-10
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Convert square degrees to hectares using the same formula as overlapping validator
   */
  private convertSquareDegreesToHectares(squareDegrees: number, latitude: number): number {
    const metersPerDegree = 111320;
    const latitudeFactor = Math.cos((latitude * Math.PI) / 180);
    const squareMeters = squareDegrees * metersPerDegree * metersPerDegree * latitudeFactor;
    return squareMeters / 10000;
  }

  /**
   * Fix overlaps between polygons using accurate database intersection data
   * For each pair of overlapping polygons:
   * - Check if overlap meets conditions (≤ 3.5% AND ≤ 0.1 hectares)
   * - If yes, clip the overlap from the LARGER polygon
   */
  private async fixOverlapsWithDatabaseData(
    origData: PolygonData[],
    intersectionData: IntersectionData[]
  ): Promise<Record<number, Polygon | MultiPolygon>> {
    const changes: Record<number, Polygon | MultiPolygon> = {};
    const processed = new Set<string>(); // Track processed pairs

    // Create a map of UUID to polygon data for quick lookup
    const uuidToDataMap = new Map<string, PolygonData>();
    for (const data of origData) {
      uuidToDataMap.set(data.properties.poly_id, data);
    }

    // Process each intersection from the database
    for (const intersection of intersectionData) {
      const pairKey = [intersection.targetUuid, intersection.candidateUuid].sort().join("-");

      // Skip if we've already processed this pair
      if (processed.has(pairKey)) {
        continue;
      }
      processed.add(pairKey);

      const polyA = uuidToDataMap.get(intersection.targetUuid);
      const polyB = uuidToDataMap.get(intersection.candidateUuid);

      if (polyA === undefined || polyB === undefined) {
        continue;
      }

      try {
        // Get current geometries (use changed version if available)
        const geomA = changes[polyA.index] ?? polyA.geometry;
        const geomB = changes[polyB.index] ?? polyB.geometry;

        // Check if they still intersect (after potential previous clipping)
        if (!geometryIntersects(geomA, geomB)) {
          continue;
        }

        // Use database areas (in square degrees)
        const areaA = intersection.targetArea;
        const areaB = intersection.candidateArea;
        const minArea = Math.min(areaA, areaB);

        // Calculate percentage using database areas
        const pctOverlap = Math.round((intersection.intersectionArea / minArea) * 100 * 100) / 100;

        // Convert intersection area to hectares using the same method as overlapping validator
        const areaOverlapHectares = this.convertSquareDegreesToHectares(
          intersection.intersectionArea,
          intersection.intersectionLatitude
        );

        // Determine smaller and larger polygons
        const smaller =
          areaA < areaB
            ? { index: polyA.index, geom: geomA, uuid: polyA.properties.poly_id }
            : { index: polyB.index, geom: geomB, uuid: polyB.properties.poly_id };
        const larger =
          areaA >= areaB
            ? { index: polyA.index, geom: geomA, uuid: polyA.properties.poly_id }
            : { index: polyB.index, geom: geomB, uuid: polyB.properties.poly_id };

        this.logger.debug(
          `Overlap between ${intersection.targetUuid} and ${intersection.candidateUuid}: ${pctOverlap.toFixed(
            2
          )}%, ${areaOverlapHectares.toFixed(4)} ha`
        );

        // Check if overlap meets conditions for clipping
        if (
          pctOverlap <= this.OVERLAP_CONDITIONS.maxPercentage &&
          areaOverlapHectares <= this.OVERLAP_CONDITIONS.maxAreaHectares
        ) {
          this.logger.log(
            `Clipping overlap from larger polygon ${larger.uuid}. Overlap: ${pctOverlap.toFixed(
              2
            )}%, ${areaOverlapHectares.toFixed(4)} ha`
          );

          // Buffer smaller polygon slightly (as in Python script)
          const smallerBuffered = bufferGeometry(smaller.geom, this.BUFFER_DISTANCE);

          if (smallerBuffered === null) {
            this.logger.warn(`Failed to buffer smaller polygon. Skipping.`);
            continue;
          }

          // Clip overlap from larger polygon
          const largerClipped = geometryDifference(larger.geom, smallerBuffered);

          if (largerClipped === null) {
            this.logger.warn(
              `Invalid geometry after difference operation between ${smaller.uuid} and ${larger.uuid}. Skipping.`
            );
            continue;
          }

          // Store the modified larger polygon
          changes[larger.index] = largerClipped as Polygon | MultiPolygon;
        }
      } catch (error) {
        this.logger.error(
          `Error processing overlap between ${intersection.targetUuid} and ${intersection.candidateUuid}: ${error}`
        );
        continue;
      }
    }

    this.logger.log(`Fixed ${Object.keys(changes).length} overlaps`);
    return changes;
  }

  /**
   * Create output GeoJSON with only modified polygons
   */
  private createOutputGeojson(
    origData: PolygonData[],
    changes: Record<number, Polygon | MultiPolygon>
  ): FeatureCollection<Polygon | MultiPolygon> {
    const outputFeatures: PolygonFeature[] = [];

    // Only include polygons that were modified
    for (const [indexStr, geometry] of Object.entries(changes)) {
      const index = parseInt(indexStr, 10);
      const originalData = origData.find(d => d.index === index);

      if (originalData !== undefined) {
        outputFeatures.push({
          type: "Feature",
          geometry,
          properties: originalData.properties
        });
      }
    }

    return {
      type: "FeatureCollection",
      features: outputFeatures
    };
  }

  /**
   * Filter polygons to only those with fixable overlaps
   * Checks the overlapping criteria from CriteriaSite extra_info
   */
  async filterFixableOverlappingPolygons(polygonUuids: string[]): Promise<string[]> {
    // This would need to check the CriteriaSite table for overlapping criteria
    // For now, we'll return all UUIDs as the filtering will happen during clipping
    // This can be enhanced later when we integrate with the validation system
    this.logger.log(`Filtering ${polygonUuids.length} polygons for fixable overlaps`);
    return polygonUuids;
  }
}
