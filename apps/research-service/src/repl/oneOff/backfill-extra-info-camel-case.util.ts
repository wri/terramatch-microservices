import { camelCase, isEqual } from "lodash";
import { CriteriaId, VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";

/**
 * Maps legacy DATA_COMPLETENESS `field` string values to the current camelCase contract.
 * `plantstart` cannot be fixed by lodash camelCase (no word boundary).
 * Can be removed after all environments have been updated.
 */
const DATA_COMPLETENESS_FIELD_VALUES: Record<string, string> = {
  poly_name: "polyName",
  polyName: "polyName",
  target_sys: "targetSys",
  targetSys: "targetSys",
  num_trees: "numTrees",
  numTrees: "numTrees",
  plantstart: "plantStart",
  plantStart: "plantStart",
  planting_status: "plantingStatus",
  plantingStatus: "plantingStatus",
  practice: "practice",
  distr: "distr",
  properties: "properties"
};

const OBSOLETE_DATA_COMPLETENESS_FIELDS = new Set(["plantend", "plantEnd"]);

function transformKeysToCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => transformKeysToCamelCase(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const transformed: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    transformed[camelCase(key)] = transformKeysToCamelCase(entryValue);
  }
  return transformed;
}

function normalizeDataCompletenessExtraInfo(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map(item => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return item;
      }

      const record = { ...(item as Record<string, unknown>) };
      if (typeof record.field !== "string") {
        return record;
      }

      if (OBSOLETE_DATA_COMPLETENESS_FIELDS.has(record.field)) {
        return null;
      }

      record.field = DATA_COMPLETENESS_FIELD_VALUES[record.field] ?? record.field;
      return record;
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

/**
 * Rewrites a stored `criteria_site.extra_info` JSON value to the current camelCase API contract.
 * Idempotent: applying twice yields the same result.
 *
 * Criteria 16 keeps the original duplicate shape with camelCase keys only
 * (`polyUuid`, `polyName`, `siteName`) — no reshape.
 */
export function transformCriteriaSiteExtraInfo(extraInfo: unknown, criteriaId: CriteriaId): unknown {
  const withCamelKeys = transformKeysToCamelCase(extraInfo);

  if (criteriaId === VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS) {
    return normalizeDataCompletenessExtraInfo(withCamelKeys);
  }

  return withCamelKeys;
}

export function extraInfoNeedsBackfill(extraInfo: unknown, criteriaId: CriteriaId): boolean {
  return !isEqual(extraInfo, transformCriteriaSiteExtraInfo(extraInfo, criteriaId));
}
