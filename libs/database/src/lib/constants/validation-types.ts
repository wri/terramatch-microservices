export const VALIDATION_TYPES = ["SELF_INTERSECTION", "SPIKES", "DATA_COMPLETENESS", "PLANT_START_DATE"] as const;

export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const VALIDATION_CRITERIA_IDS = {
  SELF_INTERSECTION: 4,
  SPIKES: 8,
  DATA_COMPLETENESS: 14,
  PLANT_START_DATE: 15
} as const;

export type CriteriaId = (typeof VALIDATION_CRITERIA_IDS)[ValidationType];
