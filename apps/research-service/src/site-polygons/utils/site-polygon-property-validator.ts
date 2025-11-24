import { SitePolygon } from "@terramatch-microservices/database/entities";

const CORE_PROPERTY_KEYS = [
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

const EXCLUDED_PROPERTY_KEYS = ["area", "uuid"] as const;

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
  let plantstart: Date | null = null;
  if (properties.plantstart != null && properties.plantstart !== "") {
    const parsedDate = new Date(properties.plantstart as string);
    plantstart = !isNaN(parsedDate.getTime()) ? parsedDate : null;
  }

  const numTrees =
    typeof properties.num_trees === "number" && Number.isInteger(properties.num_trees) ? properties.num_trees : null;

  const distr = validateArrayProperty(properties.distr, VALID_DISTRIBUTION_VALUES);
  const practice = validateArrayProperty(properties.practice, VALID_PRACTICE_VALUES);
  const targetSys = validateTargetSys((properties.target_sys as string) ?? "");

  return {
    polyName: (properties.poly_name as string) ?? null,
    siteUuid: (properties.site_id as string) ?? null,
    plantStart: plantstart,
    practice: practice,
    targetSys: targetSys,
    distr: distr,
    numTrees: numTrees,
    calcArea: (properties.area as number) ?? null,
    status: "draft" as const,
    pointUuid: (properties.point_id as string) ?? null,
    source: (properties.source as string) ?? null
  };
}

export function extractAdditionalData(properties: Record<string, unknown>): Record<string, unknown> {
  const additionalData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (
      !CORE_PROPERTY_KEYS.includes(key as (typeof CORE_PROPERTY_KEYS)[number]) &&
      !EXCLUDED_PROPERTY_KEYS.includes(key as (typeof EXCLUDED_PROPERTY_KEYS)[number])
    ) {
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
