export const REPORT_TYPES = ["project-reports", "site-reports", "nursery-reports"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const ENTITY_TYPES = ["projects", "sites", "nurseries", ...REPORT_TYPES] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
