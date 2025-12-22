import { SitePolygon } from "@terramatch-microservices/database/entities";

// Core property keys in both formats
const CORE_PROPERTY_KEYS_SNAKE_CASE = [
  "poly_name",
  "site_id",
  "plantstart",
  "practice",
  "target_sys",
  "distr",
  "num_trees",
  "area",
  "status",
  "point_id",
  "source"
] as const;

const CORE_PROPERTY_KEYS_CAMEL_CASE = [
  "polyName",
  "siteId",
  "plantStart",
  "practice",
  "targetSys",
  "distr",
  "numTrees",
  "area",
  "status",
  "pointId",
  "source"
] as const;

const CORE_PROPERTY_KEYS = [...CORE_PROPERTY_KEYS_SNAKE_CASE, ...CORE_PROPERTY_KEYS_CAMEL_CASE] as const;

const EXCLUDED_PROPERTY_KEYS = ["area", "uuid"] as const;

function getPropertyValue(properties: Record<string, unknown>, camelCaseKey: string, snakeCaseKey: string): unknown {
  return properties[camelCaseKey] != null ? properties[camelCaseKey] : properties[snakeCaseKey];
}

export const VALID_DISTRIBUTION_VALUES = ["full", "partial", "single-line"] as const;

export const VALID_PRACTICE_VALUES = ["assisted-natural-regeneration", "direct-seeding", "tree-planting"] as const;

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map(v => v.trim());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map(v => v.trim());
        }
      } catch {
        // Fall through to comma-separated handling
      }
    }

    return trimmed
      .split(",")
      .map(v => v.trim())
      .filter(v => v !== "");
  }

  return [];
}

export function validateArrayProperty(value: unknown, validValues: readonly string[]): string[] | null {
  const values = toArray(value);
  if (values.length === 0) return null;

  const validValuesSet = new Set(validValues);
  const filtered = values.filter(v => validValuesSet.has(v));

  return filtered.length > 0 ? filtered.sort() : null;
}

export function validateSitePolygonProperties(properties: Record<string, unknown>): Partial<SitePolygon> {
  // Get values, preferring camelCase over snake_case
  const polyNameValue = getPropertyValue(properties, "polyName", "poly_name");
  const siteIdValue = getPropertyValue(properties, "siteId", "site_id");
  const plantStartValue = getPropertyValue(properties, "plantStart", "plantstart");
  const targetSysValue = getPropertyValue(properties, "targetSys", "target_sys");
  const numTreesValue = getPropertyValue(properties, "numTrees", "num_trees");
  const pointIdValue = getPropertyValue(properties, "pointId", "point_id");
  const distrValue = properties.distr; // Same in both formats
  const practiceValue = properties.practice; // Same in both formats
  const sourceValue = properties.source; // Same in both formats
  const areaValue = properties.area; // Same in both formats

  let plantStart: Date | null = null;
  if (plantStartValue != null && plantStartValue !== "") {
    const parsedDate = new Date(plantStartValue as string);
    plantStart = !isNaN(parsedDate.getTime()) ? parsedDate : null;
  }

  const numTrees = typeof numTreesValue === "number" && Number.isInteger(numTreesValue) ? numTreesValue : null;

  const distr = validateArrayProperty(distrValue, VALID_DISTRIBUTION_VALUES);
  const practice = validateArrayProperty(practiceValue, VALID_PRACTICE_VALUES);
  const targetSys = validateTargetSys((targetSysValue as string) ?? "");

  return {
    polyName: (polyNameValue as string) ?? null,
    siteUuid: (siteIdValue as string) ?? null,
    plantStart: plantStart,
    practice: practice,
    targetSys: targetSys,
    distr: distr,
    numTrees: numTrees,
    calcArea: (areaValue as number) ?? null,
    status: "draft" as const,
    pointUuid: (pointIdValue as string) ?? null,
    source: (sourceValue as string) ?? null
  };
}

export function extractAdditionalData(properties: Record<string, unknown>): Record<string, unknown> {
  const additionalData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Check if key is a core property in either format
    const isCoreProperty =
      CORE_PROPERTY_KEYS.includes(key as (typeof CORE_PROPERTY_KEYS)[number]) ||
      EXCLUDED_PROPERTY_KEYS.includes(key as (typeof EXCLUDED_PROPERTY_KEYS)[number]);

    if (!isCoreProperty) {
      additionalData[key] = value;
    }
  }

  return additionalData;
}

export function orderCommaSeparatedPropertiesAlphabetically(
  value: string,
  validValues: readonly string[]
): string[] | null {
  if (value == null || value.trim().length === 0) return null;

  const values = value
    .split(",")
    .map(v => v.trim())
    .filter(v => v !== "");

  const validValuesSet = new Set(validValues);
  const filteredValues = values.filter(v => validValuesSet.has(v));

  return filteredValues.length > 0 ? filteredValues.sort() : null;
}

export function validateAndSortStringArray(
  value: string[] | null | undefined,
  validValues: readonly string[]
): string[] | null {
  if (value == null || !Array.isArray(value) || value.length === 0) return null;

  const validValuesSet = new Set(validValues);
  const filteredValues = value
    .map(v => (typeof v === "string" ? v.trim() : ""))
    .filter(v => v !== "" && validValuesSet.has(v));

  return filteredValues.length > 0 ? filteredValues.sort() : null;
}

function validateTargetSys(value: string): string | null {
  if (value == null || value.trim().length === 0) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
