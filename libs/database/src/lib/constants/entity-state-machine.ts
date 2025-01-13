export const STARTED = "started";
export const AWAITING_APPROVAL = "awaiting-approval";
export const APPROVED = "approved";
export const NEEDS_MORE_INFORMATION = "needs-more-information";
export const ENTITY_STATUSES = [STARTED, AWAITING_APPROVAL, APPROVED, NEEDS_MORE_INFORMATION] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const DUE = "due";
export const REPORT_STATUSES = [DUE, ...ENTITY_STATUSES] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const DRAFT = "draft";
export const UPDATE_REQUEST_STATUSES = [DRAFT, AWAITING_APPROVAL, APPROVED, NEEDS_MORE_INFORMATION] as const;
export type UpdateRequestStatus = (typeof UPDATE_REQUEST_STATUSES)[number];
