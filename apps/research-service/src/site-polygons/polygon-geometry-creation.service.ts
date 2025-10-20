import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { QueryTypes, Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { Geometry } from "./dto/create-site-polygon-request.dto";

export interface GeometryWithArea {
  uuid: string;
  geomJson: string; // GeoJSON string for insertion
  area: number; // Area in hectares
}

@Injectable()
export class PolygonGeometryCreationService {
  private readonly logger = new Logger(PolygonGeometryCreationService.name);

  /**
   * Batch calculate areas for geometries
   * Uses PostGIS ST_Area function
   * Returns GeoJSON strings (not WKB) for direct use with ST_GeomFromGeoJSON
   */
  async batchGetGeomsAndAreas(geometries: Geometry[]): Promise<GeometryWithArea[]> {
    if (geometries.length === 0) {
      return [];
    }

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    // Build UNION query to process all geometries in one SQL call
    const geoJsonStrings = geometries.map(geom => JSON.stringify(geom));

    // Create a query that processes each geometry
    const sqlCases = geoJsonStrings
      .map((_, index) => `SELECT :geom${index} as geoJson, ${index} as idx`)
      .join(" UNION ALL ");

    const replacements: Record<string, string> = {};
    geoJsonStrings.forEach((geoJsonStr, index) => {
      replacements[`geom${index}`] = geoJsonStr;
    });

    const query = `
      WITH geom_data AS (
        ${sqlCases}
      )
      SELECT 
        idx,
        geoJson,
        ST_Area(ST_GeomFromGeoJSON(geoJson)) / 10000 as area
      FROM geom_data
      ORDER BY idx
    `;

    try {
      const results = (await PolygonGeometry.sequelize.query(query, {
        replacements,
        type: QueryTypes.SELECT
      })) as { idx: number; geoJson: string; area: number }[];

      return results.map(result => ({
        uuid: uuidv4(),
        geomJson: result.geoJson, // Keep as GeoJSON string, like V2 PHP
        area: result.area ?? 0
      }));
    } catch (error) {
      this.logger.error("Error batch processing geometries", error);
      throw new InternalServerErrorException("Failed to process geometries");
    }
  }

  /**
   * Bulk insert polygon geometries
   * Uses ST_GeomFromGeoJSON like V2 PHP
   * Returns array of created UUIDs
   */
  async bulkInsertGeometries(
    geometriesWithAreas: GeometryWithArea[],
    createdBy: number | null,
    transaction?: Transaction
  ): Promise<string[]> {
    if (geometriesWithAreas.length === 0) {
      return [];
    }

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const now = new Date();

    try {
      // Build bulk INSERT using ST_GeomFromGeoJSON (like V2 PHP)
      const valueSets = geometriesWithAreas
        .map(
          (_, index) =>
            `(:uuid${index}, ST_GeomFromGeoJSON(:geomJson${index}), :createdBy${index}, :createdAt${index}, :updatedAt${index})`
        )
        .join(", ");

      const replacements: Record<string, string | number | Date | null> = {};
      geometriesWithAreas.forEach((item, index) => {
        replacements[`uuid${index}`] = item.uuid;
        replacements[`geomJson${index}`] = item.geomJson; // GeoJSON string, not WKB
        replacements[`createdBy${index}`] = createdBy;
        replacements[`createdAt${index}`] = now;
        replacements[`updatedAt${index}`] = now;
      });

      const query = `
        INSERT INTO polygon_geometry (uuid, geom, created_by, created_at, updated_at)
        VALUES ${valueSets}
      `;

      await PolygonGeometry.sequelize.query(query, {
        replacements,
        type: QueryTypes.INSERT,
        transaction
      });

      return geometriesWithAreas.map(item => item.uuid);
    } catch (error) {
      this.logger.error("Error bulk inserting geometries", error);
      throw new InternalServerErrorException("Failed to insert geometries");
    }
  }

  /**
   * Create geometries from GeoJSON features in bulk
   * Handles both Polygon and MultiPolygon types, expanding MultiPolygons into individual Polygons
   */
  async createGeometriesFromFeatures(
    geometries: Geometry[],
    createdBy: number | null,
    transaction?: Transaction
  ): Promise<{ uuids: string[]; areas: number[] }> {
    // Expand MultiPolygons into individual Polygons
    const expandedGeometries: Geometry[] = [];
    const geometryIndexMap: number[] = []; // Track which original geometry each expanded one came from

    for (let i = 0; i < geometries.length; i++) {
      const geom = geometries[i];
      if (geom.type === "Polygon") {
        expandedGeometries.push(geom);
        geometryIndexMap.push(i);
      } else if (geom.type === "MultiPolygon") {
        // Expand MultiPolygon into multiple Polygon geometries
        const coordinates = geom.coordinates as number[][][][];
        for (const polyCoords of coordinates) {
          expandedGeometries.push({
            type: "Polygon",
            coordinates: polyCoords
          });
          geometryIndexMap.push(i);
        }
      }
    }

    // Process geometries to calculate areas (keeps GeoJSON format)
    const geometriesWithAreas = await this.batchGetGeomsAndAreas(expandedGeometries);

    // Bulk insert
    const uuids = await this.bulkInsertGeometries(geometriesWithAreas, createdBy, transaction);

    return {
      uuids,
      areas: geometriesWithAreas.map(g => g.area)
    };
  }
}
