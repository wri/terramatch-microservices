import { QueryTypes } from "sequelize";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";

export class SelfIntersectionValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<ValidationResult> {
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

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
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
      valid: Boolean(resultMap.get(polygonUuid) ?? false),
      extraInfo: null
    }));
  }
}
