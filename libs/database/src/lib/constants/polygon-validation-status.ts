export const POLYGON_VALIDATION_PASSED = "passed";
export const POLYGON_VALIDATION_PARTIAL = "partial";
export const POLYGON_VALIDATION_FAILED = "failed";

export const POLYGON_VALIDATION_STATUSES = [
  POLYGON_VALIDATION_PASSED,
  POLYGON_VALIDATION_PARTIAL,
  POLYGON_VALIDATION_FAILED
] as const;

export type PolygonValidationStatus = (typeof POLYGON_VALIDATION_STATUSES)[number];

export const POLYGON_VALIDATION_NOT_CHECKED = "not_checked";

export const POLYGON_VALIDATION_PASSING_STATUSES = [POLYGON_VALIDATION_PASSED, POLYGON_VALIDATION_PARTIAL] as const;

export type PassingPolygonValidationStatus = (typeof POLYGON_VALIDATION_PASSING_STATUSES)[number];

export const isPolygonValidationStatus = (value: string): value is PolygonValidationStatus =>
  (POLYGON_VALIDATION_STATUSES as readonly string[]).includes(value);

export const isPassingPolygonValidationStatus = (
  value: string | null | undefined
): value is PassingPolygonValidationStatus =>
  value === POLYGON_VALIDATION_PASSED || value === POLYGON_VALIDATION_PARTIAL;
