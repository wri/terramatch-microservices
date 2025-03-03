import { Nursery, NurseryReport, Project, ProjectReport, Site, SiteReport } from "../entities";
import { ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";

export const REPORT_TYPES = ["projectReports", "siteReports", "nurseryReports"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportModel = ProjectReport | SiteReport | NurseryReport;
export type ReportClass<T extends ReportModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const REPORT_MODELS: { [R in ReportType]: ReportClass<ReportModel> } = {
  projectReports: ProjectReport,
  siteReports: SiteReport,
  nurseryReports: NurseryReport
};

export const ENTITY_TYPES = ["projects", "sites", "nurseries", ...REPORT_TYPES] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type EntityModel = ReportModel | Project | Site | Nursery;
export type EntityClass<T extends EntityModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const ENTITY_MODELS: { [E in EntityType]: EntityClass<EntityModel> } = {
  ...REPORT_MODELS,
  projects: Project,
  sites: Site,
  nurseries: Nursery
};
