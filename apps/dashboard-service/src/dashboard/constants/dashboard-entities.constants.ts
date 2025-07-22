export const DASHBOARD_PROJECTS = "dashboardProjects";
export const DASHBOARD_SITEPOLYGONS = "dashboardSitePolygons";

export const DASHBOARD_ENTITIES = [DASHBOARD_PROJECTS, DASHBOARD_SITEPOLYGONS] as const;
export type DashboardEntity = (typeof DASHBOARD_ENTITIES)[number];
