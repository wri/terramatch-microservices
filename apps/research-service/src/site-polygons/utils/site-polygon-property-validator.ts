import { SitePolygon } from "@terramatch-microservices/database/entities";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const logger = new TMLogger("SitePolygonPropertyValidator");

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

const VALID_DISTRIBUTION_VALUES = ["full", "partial", "single-line"] as const;

const VALID_PRACTICE_VALUES = ["assisted-natural-regeneration", "direct-seeding", "tree-planting"] as const;

export function validateSitePolygonProperties(properties: Record<string, unknown>): Partial<SitePolygon> {
  let plantstart: Date | null = null;
  if (properties.plantstart != null && properties.plantstart !== "") {
    try {
      const parsedDate = new Date(properties.plantstart as string);
      plantstart = !isNaN(parsedDate.getTime()) ? parsedDate : null;
    } catch (error) {
      logger.error("Error parsing plantstart date:", error);
      plantstart = null;
    }
  }
  const numTrees =
    typeof properties.num_trees === "number" && Number.isInteger(properties.num_trees) ? properties.num_trees : null;

  const distr = orderCommaSeparatedPropertiesAlphabetically(
    (properties.distr as string) ?? "",
    VALID_DISTRIBUTION_VALUES
  );

  const practice = orderCommaSeparatedPropertiesAlphabetically(
    (properties.practice as string) ?? "",
    VALID_PRACTICE_VALUES
  );

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

function orderCommaSeparatedPropertiesAlphabetically(value: string, validValues: readonly string[]): string | null {
  if (value == null || value.trim().length === 0) return null;

  const values = value
    .split(",")
    .map(v => v.trim())
    .filter(v => v !== "");

  const validValuesSet = new Set(validValues);
  const filteredValues = values.filter(v => validValuesSet.has(v));

  return filteredValues.length > 0 ? filteredValues.sort().join(",") : null;
}

function validateTargetSys(value: string): string | null {
  if (value == null || value.trim().length === 0) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
