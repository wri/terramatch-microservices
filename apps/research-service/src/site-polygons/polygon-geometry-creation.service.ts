import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Geometry } from "@terramatch-microservices/database/constants";
import { QueryTypes, Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { Polygon } from "geojson";

export interface GeometryWithArea {
  uuid: string;
  geomJson: string;
  area: number;
}

@Injectable()
export class PolygonGeometryCreationService {
  private readonly logger = new Logger(PolygonGeometryCreationService.name);

  async batchPrepareGeometries(geometries: Geometry[]): Promise<GeometryWithArea[]> {
    if (geometries.length === 0) {
      return [];
    }

    try {
      const polygonGeometries = geometries.filter(geom => geom.type === "Polygon" || geom.type === "MultiPolygon") as {
        type: "Polygon" | "MultiPolygon";
        coordinates: number[][][] | number[][][][];
      }[];

      const areaResults = await PolygonGeometry.batchCalculateAreas(polygonGeometries);

      return geometries.map(geom => ({
        uuid: uuidv4(),
        geomJson: JSON.stringify(geom),
        area:
          geom.type === "Polygon" || geom.type === "MultiPolygon"
            ? areaResults[geometries.filter(g => g.type === "Polygon" || g.type === "MultiPolygon").indexOf(geom)]
                ?.area ?? 0
            : 0
      }));
    } catch (error) {
      this.logger.error("Error preparing geometries", error);
      throw new InternalServerErrorException("Failed to prepare geometries");
    }
  }
  async bulkInsertGeometries(
    geometriesWithAreas: GeometryWithArea[],
    createdBy: number | null,
    transaction?: Transaction
  ): Promise<string[]> {
    if (geometriesWithAreas.length === 0) {
      return [];
    }

    try {
      const polygonGeometries = geometriesWithAreas.map(item => {
        const polygon = JSON.parse(item.geomJson) as Polygon;
        return {
          uuid: item.uuid,
          polygon,
          createdBy
        };
      });

      const created = await PolygonGeometry.bulkCreate(polygonGeometries as PolygonGeometry[], {
        transaction
      });

      return created.map(item => item.uuid);
    } catch (error) {
      this.logger.error("Error bulk inserting geometries", error);
      throw new InternalServerErrorException(
        `Failed to insert geometries: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async createGeometriesFromFeatures(
    geometries: Geometry[],
    createdBy: number | null,
    transaction?: Transaction
  ): Promise<{ uuids: string[]; areas: number[] }> {
    const expandedGeometries: Geometry[] = [];
    const geometryIndexMap: number[] = [];

    for (let i = 0; i < geometries.length; i++) {
      const geom = geometries[i];
      if (geom.type === "Polygon") {
        expandedGeometries.push(geom);
        geometryIndexMap.push(i);
      } else if (geom.type === "MultiPolygon") {
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

    const geometriesWithUuids: GeometryWithArea[] = expandedGeometries.map(geom => ({
      uuid: uuidv4(),
      geomJson: JSON.stringify(geom),
      area: 0
    }));

    const uuids = await this.bulkInsertGeometries(geometriesWithUuids, createdBy, transaction);

    const areas = await this.calculateAreasFromStoredGeometries(uuids, transaction);

    return {
      uuids,
      areas
    };
  }

  private async calculateAreasFromStoredGeometries(
    polygonUuids: string[],
    transaction?: Transaction
  ): Promise<number[]> {
    if (polygonUuids.length === 0) {
      return [];
    }

    try {
      const placeholders = polygonUuids.map((_, index) => `:uuid${index}`).join(",");
      const replacements: Record<string, string> = {};
      polygonUuids.forEach((uuid, index) => {
        replacements[`uuid${index}`] = uuid;
      });

      const orderCases = polygonUuids.map((uuid, index) => `WHEN uuid = :uuid${index} THEN ${index}`).join(" ");
      const orderByCase = `CASE ${orderCases} END`;

      const query = `
        SELECT
          uuid,
          ST_Area(geom) *
          POW(6378137 * PI() / 180, 2) *
          COS(RADIANS(ST_Y(ST_Centroid(geom)))) / 10000 as area_hectares
        FROM polygon_geometry
        WHERE uuid IN (${placeholders})
        ORDER BY ${orderByCase}
      `;

      const results = (await PolygonGeometry.sql.query(query, {
        replacements,
        type: QueryTypes.SELECT,
        transaction
      })) as Array<{
        uuid: string;
        area_hectares: number | null;
      }>;

      return results.map(result => {
        const area = result.area_hectares ?? 0;
        return Number.isNaN(area) ? 0 : area;
      });
    } catch (error) {
      this.logger.error("Error calculating areas from stored geometries", error);
      throw new InternalServerErrorException("Failed to calculate areas from stored geometries");
    }
  }

  async bulkUpdateSitePolygonCentroids(polygonUuids: string[], transaction?: Transaction): Promise<void> {
    if (polygonUuids.length === 0) {
      return;
    }

    try {
      const placeholders = polygonUuids.map((_, index) => `:uuid${index}`).join(",");
      const replacements: Record<string, string> = {};
      polygonUuids.forEach((uuid, index) => {
        replacements[`uuid${index}`] = uuid;
      });

      const query = `
        UPDATE site_polygon sp
        JOIN polygon_geometry pg ON sp.poly_id = pg.uuid
        SET
          sp.lat = ST_Y(ST_Centroid(pg.geom)),
          sp.long = ST_X(ST_Centroid(pg.geom))
        WHERE sp.poly_id IN (${placeholders})
      `;

      await PolygonGeometry.sql.query(query, {
        replacements,
        type: QueryTypes.UPDATE,
        transaction
      });

      this.logger.log(`Updated centroids for ${polygonUuids.length} site polygons`);
    } catch (error) {
      this.logger.error("Error bulk updating site polygon centroids", error);
      throw new InternalServerErrorException("Failed to update site polygon centroids");
    }
  }

  async bulkUpdateSitePolygonAreas(polygonUuids: string[], transaction?: Transaction): Promise<void> {
    if (polygonUuids.length === 0) {
      return;
    }

    try {
      const placeholders = polygonUuids.map((_, index) => `:uuid${index}`).join(",");
      const replacements: Record<string, string> = {};
      polygonUuids.forEach((uuid, index) => {
        replacements[`uuid${index}`] = uuid;
      });

      const checkQuery = `
        SELECT
          sp.poly_id,
          sp.uuid as site_polygon_uuid,
          ST_Area(pg.geom) as st_area,
          ST_Y(ST_Centroid(pg.geom)) as centroid_y,
          COS(RADIANS(ST_Y(ST_Centroid(pg.geom)))) as cos_value,
          ST_Area(pg.geom) *
          POW(6378137 * PI() / 180, 2) *
          COS(RADIANS(ST_Y(ST_Centroid(pg.geom)))) / 10000 as calculated_area
        FROM site_polygon sp
        JOIN polygon_geometry pg ON sp.poly_id = pg.uuid
        WHERE sp.poly_id IN (${placeholders})
      `;

      const checkResults = (await PolygonGeometry.sql.query(checkQuery, {
        replacements,
        type: QueryTypes.SELECT,
        transaction
      })) as Array<{
        poly_id: string;
        site_polygon_uuid: string;
        st_area: number | null;
        centroid_y: number | null;
        cos_value: number | null;
        calculated_area: number | null;
      }>;

      for (const checkResult of checkResults) {
        const calculatedArea = checkResult.calculated_area;
        const isNaN = calculatedArea != null && Number.isNaN(calculatedArea);
        const isNull = calculatedArea == null;

        if (isNaN || isNull) {
          this.logger.error(`[bulkUpdateSitePolygonAreas] Potential NaN/Null detected before update:`, {
            poly_id: checkResult.poly_id,
            site_polygon_uuid: checkResult.site_polygon_uuid,
            st_area: checkResult.st_area,
            centroid_y: checkResult.centroid_y,
            cos_value: checkResult.cos_value,
            calculated_area: calculatedArea,
            isNaN,
            isNull
          });
        }
      }

      const query = `
        UPDATE site_polygon sp
        JOIN polygon_geometry pg ON sp.poly_id = pg.uuid
        SET
          sp.calc_area = ST_Area(pg.geom) *
          POW(6378137 * PI() / 180, 2) *
          COS(RADIANS(ST_Y(ST_Centroid(pg.geom)))) / 10000
        WHERE sp.poly_id IN (${placeholders})
      `;

      this.logger.log(`[bulkUpdateSitePolygonAreas] Updating areas for ${polygonUuids.length} site polygons`, {
        polygonUuids: polygonUuids.slice(0, 5),
        totalCount: polygonUuids.length
      });

      await PolygonGeometry.sql.query(query, {
        replacements,
        type: QueryTypes.UPDATE,
        transaction
      });

      const verifyQuery = `
        SELECT
          sp.poly_id,
          sp.uuid as site_polygon_uuid,
          sp.calc_area
        FROM site_polygon sp
        WHERE sp.poly_id IN (${placeholders})
      `;

      const verifyResults = (await PolygonGeometry.sql.query(verifyQuery, {
        replacements,
        type: QueryTypes.SELECT,
        transaction
      })) as Array<{
        poly_id: string;
        site_polygon_uuid: string;
        calc_area: number | null;
      }>;

      for (const verifyResult of verifyResults) {
        const calcArea = verifyResult.calc_area;
        const isNaN = calcArea != null && (Number.isNaN(calcArea) || String(calcArea).toLowerCase() === "nan");
        const isNull = calcArea == null;

        if (isNaN) {
          this.logger.error(`[bulkUpdateSitePolygonAreas] NaN detected after update!`, {
            poly_id: verifyResult.poly_id,
            site_polygon_uuid: verifyResult.site_polygon_uuid,
            calc_area: calcArea,
            calc_area_type: typeof calcArea,
            calc_area_string: String(calcArea)
          });
        } else if (isNull) {
          this.logger.warn(`[bulkUpdateSitePolygonAreas] Null calc_area after update:`, {
            poly_id: verifyResult.poly_id,
            site_polygon_uuid: verifyResult.site_polygon_uuid
          });
        }
      }

      this.logger.log(`Updated areas for ${polygonUuids.length} site polygons`);
    } catch (error) {
      this.logger.error("Error bulk updating site polygon areas", error);
      throw new InternalServerErrorException("Failed to update site polygon areas");
    }
  }

  async bulkUpdateProjectCentroids(polygonUuids: string[], transaction?: Transaction): Promise<void> {
    if (polygonUuids.length === 0) {
      return;
    }

    try {
      const placeholders = polygonUuids.map((_, index) => `:uuid${index}`).join(",");
      const replacements: Record<string, string> = {};
      polygonUuids.forEach((uuid, index) => {
        replacements[`uuid${index}`] = uuid;
      });

      const query = `
        UPDATE v2_projects p
        JOIN (
          SELECT
            s.project_id,
            AVG(ST_Y(ST_Centroid(pg.geom))) as avg_lat,
            AVG(ST_X(ST_Centroid(pg.geom))) as avg_long
          FROM site_polygon sp
          JOIN polygon_geometry pg ON sp.poly_id = pg.uuid
          JOIN v2_sites s ON s.uuid = sp.site_id
          WHERE s.project_id = (
            SELECT DISTINCT s2.project_id
            FROM site_polygon sp2
            JOIN v2_sites s2 ON s2.uuid = sp2.site_id
            WHERE sp2.poly_id IN (${placeholders})
            LIMIT 1
          )
            AND sp.is_active = 1
            AND pg.geom IS NOT NULL
          GROUP BY s.project_id
        ) centroids ON centroids.project_id = p.id
        SET
          p.lat = centroids.avg_lat,
          p.long = centroids.avg_long
      `;

      await PolygonGeometry.sql.query(query, {
        replacements,
        type: QueryTypes.UPDATE,
        transaction
      });

      this.logger.log(`Updated project centroids for affected project`);
    } catch (error) {
      this.logger.error("Error bulk updating project centroids", error);
      throw new InternalServerErrorException("Failed to update project centroids");
    }
  }
}
