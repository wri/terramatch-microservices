import { Geometry } from "geojson";

export interface ValidationResult {
  valid: boolean;
  extraInfo: object | null;
}

export interface PolygonValidationResult {
  polygonUuid: string;
  valid: boolean;
  extraInfo: object | null;
}

export interface PolygonValidator {
  validatePolygon(polygonUuid: string): Promise<ValidationResult>;
  validatePolygons?(polygonUuids: string[]): Promise<PolygonValidationResult[]>;
}

export interface GeometryValidator {
  validateGeometry(geometry: Geometry, properties?: Record<string, unknown>): Promise<ValidationResult>;
}

export type Validator = PolygonValidator | GeometryValidator | (PolygonValidator & GeometryValidator);

export function isPolygonValidator(validator: Validator): validator is PolygonValidator {
  if (validator === null || validator === undefined) {
    return false;
  }
  return "validatePolygon" in validator && typeof (validator as PolygonValidator).validatePolygon === "function";
}

export function isGeometryValidator(validator: Validator): validator is GeometryValidator {
  if (validator === null || validator === undefined) {
    return false;
  }
  return "validateGeometry" in validator && typeof (validator as GeometryValidator).validateGeometry === "function";
}
