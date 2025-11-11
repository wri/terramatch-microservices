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

export const isPolygonValidator = (validator: Validator | null | undefined): validator is PolygonValidator =>
  validator != null && typeof (validator as PolygonValidator).validatePolygon === "function";

export const isGeometryValidator = (validator: Validator | null | undefined): validator is GeometryValidator =>
  validator != null && typeof (validator as GeometryValidator).validateGeometry === "function";
