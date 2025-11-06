import { Validator, ValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Geometry } from "geojson";

interface GeometryTypeValidationResult extends ValidationResult {
  extraInfo: {
    actualType: string;
    validTypes: string[];
  } | null;
}

const VALID_GEOMETRY_TYPES = ["Polygon", "MultiPolygon", "Point"] as const;

export class GeometryTypeValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<ValidationResult> {
    throw new NotFoundException(
      "GeometryTypeValidator does not support polygon UUID validation. Use validateGeometry instead."
    );
  }

  async validateGeometry(
    geometry: Geometry,
    properties?: Record<string, unknown>
  ): Promise<GeometryTypeValidationResult> {
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
