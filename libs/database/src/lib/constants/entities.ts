import {
  DisturbanceReport,
  FinancialReport,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectPitch,
  ProjectReport,
  Site,
  SiteReport,
  SrpReport
} from "../entities";
import { Model, ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";
import { kebabCase } from "lodash";

export const REPORT_TYPES = [
  "projectReports",
  "siteReports",
  "nurseryReports",
  "financialReports",
  "disturbanceReports",
  "srpReports"
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportModel = ProjectReport | SiteReport | NurseryReport | FinancialReport | DisturbanceReport | SrpReport;
export type ReportClass<T extends ReportModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const REPORT_MODELS: Record<ReportType, ReportClass<ReportModel>> = {
  projectReports: ProjectReport,
  siteReports: SiteReport,
  nurseryReports: NurseryReport,
  financialReports: FinancialReport,
  disturbanceReports: DisturbanceReport,
  srpReports: SrpReport
};

export const NOTHING_TO_REPORT_MODELS = [SiteReport, NurseryReport, FinancialReport, DisturbanceReport, SrpReport];
export type NothingToReportModel = SiteReport | NurseryReport | FinancialReport | DisturbanceReport | SrpReport;

export const TASK_MODELS = [ProjectReport, SiteReport, NurseryReport, SrpReport];
export type TaskModel = ProjectReport | SiteReport | NurseryReport | SrpReport;

export const ENTITY_TYPES = ["projects", "sites", "nurseries", ...REPORT_TYPES] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type EntityModel = ReportModel | Project | Site | Nursery;
export type EntityClass<T extends EntityModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const ENTITY_MODELS: Record<EntityType, EntityClass<EntityModel>> = {
  ...REPORT_MODELS,
  projects: Project,
  sites: Site,
  nurseries: Nursery
};

export const FORM_MODEL_TYPES = [...ENTITY_TYPES, "organisations", "projectPitches"] as const;
export type FormModelType = (typeof FORM_MODEL_TYPES)[number];

export type FormModel = EntityModel | Organisation | ProjectPitch;
export type FormClass<T extends FormModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const FORM_MODELS: Record<FormModelType, FormClass<FormModel>> = {
  ...ENTITY_MODELS,
  organisations: Organisation,
  projectPitches: ProjectPitch
};

export const formModelType = (model: FormModel) => FORM_MODEL_TYPES.find(type => model instanceof FORM_MODELS[type]);

export const isEntity = (entity: Model): entity is EntityModel =>
  Object.values(ENTITY_MODELS).find(model => entity instanceof model) != null;
export const isReport = (entity: Model): entity is ReportModel =>
  Object.values(REPORT_MODELS).find(model => entity instanceof model) != null;
export const hasNothingToReport = (entity: Model): entity is NothingToReportModel =>
  NOTHING_TO_REPORT_MODELS.find(model => entity instanceof model) != null;
export const hasTaskId = (entity: Model): entity is TaskModel =>
  TASK_MODELS.find(model => entity instanceof model) != null;

/**
 * Get the project ID associated with the given entity, which may be any one of EntityModels defined in this file.
 *
 * Note: this method does require that for sites, nurseries and project reports, the entity's projectId must have
 * been loaded when it was fetched from the DB, or `undefined` will be returned. Likewise, For site reports and
 * nursery reports, the associated parent entity's id must be included.
 */
export async function getProjectId(entity: EntityModel) {
  if (entity instanceof Project) return entity.id;
  if (
    entity instanceof Site ||
    entity instanceof Nursery ||
    entity instanceof ProjectReport ||
    entity instanceof DisturbanceReport ||
    entity instanceof SrpReport
  )
    return entity.projectId;

  // FinancialReport does not have a projectId, return undefined
  if (entity instanceof FinancialReport) return undefined;

  const parentClass: ModelCtor<Site | Nursery> = entity instanceof SiteReport ? Site : Nursery;
  const parentId = entity instanceof SiteReport ? entity.siteId : entity?.nurseryId;
  return (await parentClass.findOne({ where: { id: parentId }, attributes: ["projectId"] }))?.projectId;
}

export async function getOrganisationId(entity: EntityModel) {
  if (entity instanceof Project) return entity.organisationId;
  if (entity instanceof FinancialReport) return entity.organisationId;

  return (await Project.findOne({ where: { id: await getProjectId(entity) }, attributes: ["organisationId"] }))
    ?.organisationId;
}

export function getViewLinkPath(entity: EntityModel) {
  const prefix = isReport(entity) ? "/reports/" : "/";
  return `${prefix}${kebabCase(entity.constructor.name)}/${entity.uuid}`;
}
