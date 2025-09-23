export const VALIDATION_TYPES = ["SELF_INTERSECTION", "SPIKES"] as const;

export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const VALIDATION_CRITERIA_IDS: Record<ValidationType, number> = {
  SELF_INTERSECTION: 4,
  SPIKES: 8
};
