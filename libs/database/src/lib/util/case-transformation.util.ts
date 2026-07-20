import { camelCase } from "lodash";
import { CriteriaId, VALIDATION_CRITERIA_IDS } from "../constants/validation-types";

/**
 * Bulk-rewriting historical `criteria_site` / `criteria_site_historic` `extraInfo` JSON to the
 * current camelCase contract has been deferred, so rows written before validators moved to
 * camelCase may still contain snake_case keys (and, for DATA_COMPLETENESS, a snake_case `field`
 * value). This is the single bridge that normalizes those legacy shapes to the current API
 * contract when read from the database - new writes never need it, since validators build
 * `extraInfo` in camelCase already.
 */
export function transformKeysToCamelCase(value: unknown, criteriaId: CriteriaId): unknown {
  if (Array.isArray(value)) {
    return value.map(item => transformKeysToCamelCase(item, criteriaId));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const transformed: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    const camelKey = camelCase(key);
    const isLegacyDataCompletenessFieldName =
      criteriaId === VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS &&
      camelKey === "field" &&
      typeof entryValue === "string";
    transformed[camelKey] = isLegacyDataCompletenessFieldName
      ? camelCase(entryValue as string)
      : transformKeysToCamelCase(entryValue, criteriaId);
  }
  return transformed;
}
