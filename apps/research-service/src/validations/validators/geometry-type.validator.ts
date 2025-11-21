import { GeometryValidator, ValidationResult } from "./validator.interface";
import { Geometry } from "geojson";

interface GeometryTypeValidationResult extends ValidationResult {
  extraInfo: {
    actualType: string;
    validTypes: string[];
  } | null;
}

const VALID_GEOMETRY_TYPES = ["Polygon", "MultiPolygon", "Point"] as const;

export class GeometryTypeValidator implements GeometryValidator {
  async validateGeometry(geometry: Geometry): Promise<GeometryTypeValidationResult> {
    const actualType = geometry.type;
    const valid = VALID_GEOMETRY_TYPES.includes(actualType as (typeof VALID_GEOMETRY_TYPES)[number]);

    return {
      valid,
      extraInfo: valid
        ? null
        : {
            actualType,
            validTypes: [...VALID_GEOMETRY_TYPES]
          }
    };
  }
}
