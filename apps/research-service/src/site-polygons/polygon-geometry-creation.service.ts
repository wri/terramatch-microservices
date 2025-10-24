import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Geometry } from "@terramatch-microservices/database/constants";
import { QueryTypes, Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";

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

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const now = new Date();

    try {
      const valueSets = geometriesWithAreas
        .map(
          (_, index) =>
            `(:uuid${index}, ST_GeomFromGeoJSON(:geomJson${index}), :createdBy${index}, :createdAt${index}, :updatedAt${index})`
        )
        .join(", ");

      const replacements: Record<string, string | number | Date | null> = {};
      geometriesWithAreas.forEach((item, index) => {
        replacements[`uuid${index}`] = item.uuid;
        replacements[`geomJson${index}`] = item.geomJson;
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

    const geometriesWithAreas = await this.batchPrepareGeometries(expandedGeometries);

    const uuids = await this.bulkInsertGeometries(geometriesWithAreas, createdBy, transaction);

    return {
      uuids,
      areas: geometriesWithAreas.map(g => g.area)
    };
  }

  async bulkUpdateSitePolygonCentroids(polygonUuids: string[], transaction?: Transaction): Promise<void> {
    if (polygonUuids.length === 0) {
      return;
    }

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
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

      await PolygonGeometry.sequelize.query(query, {
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

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
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
          sp.calc_area = ST_Area(pg.geom) * 
          POW(6378137 * PI() / 180, 2) * 
          COS(RADIANS(ST_Y(ST_Centroid(pg.geom)))) / 10000
        WHERE sp.poly_id IN (${placeholders})
      `;

      await PolygonGeometry.sequelize.query(query, {
        replacements,
        type: QueryTypes.UPDATE,
        transaction
      });

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

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
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

      await PolygonGeometry.sequelize.query(query, {
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
