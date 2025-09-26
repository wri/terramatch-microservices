export const VALIDATION_TYPES = ["SELF_INTERSECTION", "SPIKES", "DATA_COMPLETENESS"] as const;

export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const VALIDATION_CRITERIA_IDS = {
  SELF_INTERSECTION: 4,
  SPIKES: 8,
  DATA_COMPLETENESS: 14
} as const;

export type CriteriaId = (typeof VALIDATION_CRITERIA_IDS)[ValidationType];
