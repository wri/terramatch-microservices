import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";

export class SelfIntersectionValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<ValidationResult> {
    const isSimple = await PolygonGeometry.checkIsSimple(polygonUuid);
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
}
