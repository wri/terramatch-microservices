export interface GeoJsonValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFeatureCollectionStructure(value: unknown): GeoJsonValidationResult {
  if (value == null) {
    return { valid: false, error: "Value cannot be null or undefined" };
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const result = validateSingleFeatureCollection(value[i], i);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  }

  return validateSingleFeatureCollection(value, null);
}

function validateSingleFeatureCollection(value: unknown, index: number | null): GeoJsonValidationResult {
  const prefix = index != null ? `FeatureCollection at index ${index}` : "FeatureCollection";

  if (value == null) {
    return { valid: false, error: `${prefix} cannot be null or undefined` };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: `${prefix} must be an object` };
  }

  const fc = value as Record<string, unknown>;

  if (fc.type !== "FeatureCollection") {
    return { valid: false, error: `${prefix} must have type "FeatureCollection"` };
  }

  if (!Array.isArray(fc.features)) {
    return { valid: false, error: `${prefix} must have a "features" array` };
  }

  return { valid: true };
}
