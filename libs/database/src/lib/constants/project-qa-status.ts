export const PROJECT_QA_STATUS_DEFAULT = "due";

export const PROJECT_QA_STATUS_VALUES = [
  PROJECT_QA_STATUS_DEFAULT,
  "no-data-submitted",
  "not-applicable",
  "qa-in-progress",
  "qa-completed"
] as const;

export type ProjectQaStatus = (typeof PROJECT_QA_STATUS_VALUES)[number];
