export const DASHBOARD_ENTITIES = ["dashboardProjects"] as const;
export type DashboardEntity = (typeof DASHBOARD_ENTITIES)[number];
