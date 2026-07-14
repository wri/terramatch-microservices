export const POLYGON_DATA_SUBMISSION_AUDIT_TYPE = "polygon-data-submission";
export const READY_FOR_BASELINE_AUDIT_TYPE = "ready-for-baseline";
export const POLYGON_VALIDATION_AUDIT_TYPE = "polygon-validation";
export const PROJECT_QA_STATUS_1_AUDIT_TYPE = "project-qa-status-1";
export const PROJECT_QA_STATUS_2_AUDIT_TYPE = "project-qa-status-2";
export const PROJECT_QA_STATUS_3_AUDIT_TYPE = "project-qa-status-3";
export const PROJECT_QA_STATUS_4_AUDIT_TYPE = "project-qa-status-4";
export const PROJECT_QA_STATUS_5_AUDIT_TYPE = "project-qa-status-5";

export const PROJECT_QA_STATUS_AUDIT_TYPES = [
  PROJECT_QA_STATUS_1_AUDIT_TYPE,
  PROJECT_QA_STATUS_2_AUDIT_TYPE,
  PROJECT_QA_STATUS_3_AUDIT_TYPE,
  PROJECT_QA_STATUS_4_AUDIT_TYPE,
  PROJECT_QA_STATUS_5_AUDIT_TYPE
] as const;

export const PROJECT_QA_STATUS_FIELD_AUDIT_TYPE = {
  projectQaStatus1: PROJECT_QA_STATUS_1_AUDIT_TYPE,
  projectQaStatus2: PROJECT_QA_STATUS_2_AUDIT_TYPE,
  projectQaStatus3: PROJECT_QA_STATUS_3_AUDIT_TYPE,
  projectQaStatus4: PROJECT_QA_STATUS_4_AUDIT_TYPE,
  projectQaStatus5: PROJECT_QA_STATUS_5_AUDIT_TYPE
} as const;

export type ProjectQaStatusField = keyof typeof PROJECT_QA_STATUS_FIELD_AUDIT_TYPE;

export const AUDIT_STATUS_TYPES = [
  "change-request",
  "status",
  "submission",
  "comment",
  "change-request-updated",
  "updated",
  "reminder-sent",
  POLYGON_DATA_SUBMISSION_AUDIT_TYPE,
  READY_FOR_BASELINE_AUDIT_TYPE,
  POLYGON_VALIDATION_AUDIT_TYPE,
  ...PROJECT_QA_STATUS_AUDIT_TYPES
] as const;
export type AuditStatusType = (typeof AUDIT_STATUS_TYPES)[number];
