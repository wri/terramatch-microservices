import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { PolygonValidator, GeometryValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { Geometry } from "geojson";
import { QueryTypes } from "sequelize";

export class SelfIntersectionValidator implements PolygonValidator, GeometryValidator {
  async validatePolygon(polygonUuid: string): Promise<ValidationResult> {
    const isSimple = await PolygonGeometry.checkIsSimple(polygonUuid);
    if (isSimple == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }
    return {
      valid: isSimple,
      extraInfo: null
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const results = await PolygonGeometry.checkIsSimpleBatch(polygonUuids);
    const resultMap = new Map(results.map(({ uuid, isSimple }) => [uuid, isSimple]));

    return polygonUuids.map(polygonUuid => ({
      polygonUuid,
      valid: resultMap.get(polygonUuid) ?? false,
      extraInfo: null
    }));
  }

  async validateGeometry(geometry: Geometry): Promise<ValidationResult> {
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      return {
        valid: true,
        extraInfo: null
      };
    }

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const geomJson = JSON.stringify(geometry);
    const result = (await PolygonGeometry.sequelize.query(
      `SELECT ST_IsSimple(ST_GeomFromGeoJSON(:geomJson)) as isSimple`,
      {
        replacements: { geomJson },
        type: QueryTypes.SELECT
      }
    )) as { isSimple: boolean }[];

    const isSimple = result[0]?.isSimple ?? false;

    return {
      valid: isSimple,
      extraInfo: null
    };
  }
}
