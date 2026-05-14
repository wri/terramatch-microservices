export const POLYGON_DATA_SUBMISSION_AUDIT_TYPE = "polygon-data-submission";
export const READY_FOR_BASELINE_AUDIT_TYPE = "ready-for-baseline";

export const AUDIT_STATUS_TYPES = [
  "change-request",
  "status",
  "submission",
  "comment",
  "change-request-updated",
  "updated",
  "reminder-sent",
  POLYGON_DATA_SUBMISSION_AUDIT_TYPE,
  READY_FOR_BASELINE_AUDIT_TYPE
] as const;
export type AuditStatusType = (typeof AUDIT_STATUS_TYPES)[number];
