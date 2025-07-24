export const DASHBOARD_ENTITIES = ["projects"] as const;
export type DashboardEntity = (typeof DASHBOARD_ENTITIES)[number];
