export const DASHBOARD_PROJECTS = "dashboardProjects";
export const DASHBOARD_SITEPOLYGONS = "dashboardSitepolygons";
export const DASHBOARD_IMPACT_STORIES = "dashboardImpactStories";

export const DASHBOARD_ENTITIES = [DASHBOARD_PROJECTS, DASHBOARD_SITEPOLYGONS, DASHBOARD_IMPACT_STORIES] as const;
export type DashboardEntity = (typeof DASHBOARD_ENTITIES)[number];
