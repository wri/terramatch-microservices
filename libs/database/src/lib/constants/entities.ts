import { Nursery, NurseryReport, Project, ProjectReport, Site, SiteReport } from "../entities";
import { ModelCtor } from "sequelize-typescript";

export const REPORT_TYPES = ["project-reports", "site-reports", "nursery-reports"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportModel = ProjectReport | SiteReport | NurseryReport;
export type ReportCtor<T extends ReportModel> = ModelCtor<T> & { LARAVEL_TYPE: string };
export const REPORT_MODELS: { [R in ReportType]: ReportCtor<ReportModel> } = {
  "project-reports": ProjectReport,
  "site-reports": SiteReport,
  "nursery-reports": NurseryReport
};

export const ENTITY_TYPES = ["projects", "sites", "nurseries", ...REPORT_TYPES] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type EntityModel = ReportModel | Project | Site | Nursery;
export type EntityCtor<T extends EntityModel> = ModelCtor<T> & { LARAVEL_TYPE: string };
export const ENTITY_MODELS: { [E in EntityType]: EntityCtor<EntityModel> } = {
  ...REPORT_MODELS,
  projects: Project,
  sites: Site,
  nurseries: Nursery
};
