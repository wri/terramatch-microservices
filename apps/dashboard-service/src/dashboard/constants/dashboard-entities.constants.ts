export const DASHBOARD_ENTITIES = ["dashboardProjects", "dashboardSitePolygons"] as const;
export type DashboardEntity = (typeof DASHBOARD_ENTITIES)[number];
