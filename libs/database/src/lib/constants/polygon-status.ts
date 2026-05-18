export const POLYGON_DRAFT = "draft";
export const POLYGON_PENDING_APPROVAL = "pending-approval";
export const POLYGON_INFORMATION_REQUIRED = "information-required";
export const POLYGON_APPROVED = "approved";

export const POLYGON_STATUSES = [
  POLYGON_DRAFT,
  POLYGON_PENDING_APPROVAL,
  POLYGON_INFORMATION_REQUIRED,
  POLYGON_APPROVED
] as const;
export type PolygonStatus = (typeof POLYGON_STATUSES)[number];

export const isPolygonStatus = (value: string): value is PolygonStatus =>
  (POLYGON_STATUSES as readonly string[]).includes(value);
