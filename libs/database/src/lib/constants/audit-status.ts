export const AUDIT_STATUS_TYPES = [
  "change-request",
  "status",
  "submission",
  "comment",
  "change-request-updated",
  "updated",
  "reminder-sent"
] as const;
export type AuditStatusType = (typeof AUDIT_STATUS_TYPES)[number];
