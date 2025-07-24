export const DASHBOARD_ENTITY_TYPES = ["dashboardProjects"] as const;
export type DashboardEntity = (typeof DASHBOARD_ENTITY_TYPES)[number];
export const DASHBOARD_ENTITIES = DASHBOARD_ENTITY_TYPES;
