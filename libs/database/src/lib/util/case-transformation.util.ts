import { camelCase, snakeCase } from "lodash";
import { CriteriaId } from "../constants/validation-types";

export function transformKeysToSnakeCase(obj: unknown, criteriaId: CriteriaId): unknown {
  if (obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToSnakeCase(item, criteriaId));
  }

  if (typeof obj === "object" && obj !== null) {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = snakeCase(key);
      transformed[snakeKey] = transformKeysToSnakeCase(value, criteriaId);
    }
    return transformed;
  }

  return obj;
}

export function transformKeysToCamelCase(obj: unknown, criteriaId: CriteriaId): unknown {
  if (obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToCamelCase(item, criteriaId));
  }

  if (typeof obj === "object" && obj !== null) {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = camelCase(key);
      transformed[camelKey] = transformKeysToCamelCase(value, criteriaId);
    }
    return transformed;
  }

  return obj;
}
