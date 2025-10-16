export interface ValidationResult {
  valid: boolean;
  extraInfo: object | null;
}

export interface PolygonValidationResult {
  polygonUuid: string;
  valid: boolean;
  extraInfo: object | null;
}

export interface Validator {
  validatePolygon(polygonUuid: string): Promise<ValidationResult>;
  validatePolygons?(polygonUuids: string[]): Promise<PolygonValidationResult[]>;
}
