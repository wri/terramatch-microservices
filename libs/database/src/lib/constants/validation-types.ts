export const VALIDATION_TYPES = [
  "SELF_INTERSECTION",
  "POLYGON_SIZE",
  "SPIKES",
  "ESTIMATED_AREA",
  "DATA_COMPLETENESS",
  "PLANT_START_DATE"
] as const;

export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const VALIDATION_CRITERIA_IDS = {
  SELF_INTERSECTION: 4,
  POLYGON_SIZE: 6,
  SPIKES: 8,
  ESTIMATED_AREA: 12,
  DATA_COMPLETENESS: 14,
  PLANT_START_DATE: 15
} as const;

export type CriteriaId = (typeof VALIDATION_CRITERIA_IDS)[ValidationType];
