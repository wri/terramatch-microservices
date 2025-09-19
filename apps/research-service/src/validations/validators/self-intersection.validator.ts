import { Injectable } from "@nestjs/common";
import { QueryTypes } from "sequelize";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";

@Injectable()
export class SelfIntersectionValidator {
  async validatePolygon(polygonUuid: string): Promise<{ valid: boolean; extraInfo: object | null }> {
    if (PolygonGeometry.sequelize == null) {
      throw new Error("PolygonGeometry model is missing sequelize connection");
    }

    const result = await PolygonGeometry.sequelize.query(
      `
        SELECT ST_IsSimple(geom) as is_simple
        FROM polygon_geometry 
        WHERE uuid = :polygonUuid
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT
      }
    );

    if (result.length === 0) {
      throw new Error(`Polygon with UUID ${polygonUuid} not found`);
    }

    const isSimple = (result[0] as { is_simple: boolean }).is_simple;

    return {
      valid: isSimple,
      extraInfo: null
    };
  }

  async validatePolygons(
    polygonUuids: string[]
  ): Promise<Array<{ polygonUuid: string; valid: boolean; extraInfo: object | null }>> {
    if (PolygonGeometry.sequelize == null) {
      throw new Error("PolygonGeometry model is missing sequelize connection");
    }

    const results = await PolygonGeometry.sequelize.query(
      `
        SELECT uuid, ST_IsSimple(geom) as is_simple
        FROM polygon_geometry 
        WHERE uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT
      }
    );

    const resultMap = new Map((results as Array<{ uuid: string; is_simple: boolean }>).map(r => [r.uuid, r.is_simple]));

    return polygonUuids.map(polygonUuid => ({
      polygonUuid,
      valid: resultMap.get(polygonUuid) ?? false,
      extraInfo: null
    }));
  }
}
