export const PROJECT_QA_STATUS_DEFAULT = null;

export const PROJECT_QA_STATUS_VALUES = [
  "no-data-submitted",
  "no-data-expected",
  "qa-in-progress",
  "qa-completed"
] as const;

export type ProjectQaStatus = (typeof PROJECT_QA_STATUS_VALUES)[number];
