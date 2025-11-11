export interface GeoJsonValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFeatureCollectionStructure(value: unknown): GeoJsonValidationResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "FeatureCollection must be an object" };
  }

  const fc = value as Record<string, unknown>;

  if (fc.type !== "FeatureCollection") {
    return { valid: false, error: 'FeatureCollection must have type "FeatureCollection"' };
  }

  if (!Array.isArray(fc.features)) {
    return { valid: false, error: 'FeatureCollection must have a "features" array' };
  }

  return { valid: true };
}
