import {
  DisturbanceReport,
  FinancialReport,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "../entities";
import { ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";
import { kebabCase } from "lodash";

export const REPORT_TYPES = [
  "projectReports",
  "siteReports",
  "nurseryReports",
  "financialReports",
  "disturbanceReports"
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportModel = ProjectReport | SiteReport | NurseryReport | FinancialReport | DisturbanceReport;
export type ReportClass<T extends ReportModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const REPORT_MODELS: { [R in ReportType]: ReportClass<ReportModel> } = {
  projectReports: ProjectReport,
  siteReports: SiteReport,
  nurseryReports: NurseryReport,
  financialReports: FinancialReport,
  disturbanceReports: DisturbanceReport
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

export const isReport = (entity: EntityModel): entity is ReportModel =>
  Object.values(REPORT_MODELS).find(model => entity instanceof model) != null;

/**
 * Get the project ID associated with the given entity, which may be any one of EntityModels defined in this file.
 *
 * Note: this method does require that for sites, nurseries and project reports, the entity's projectId must have
 * been loaded when it was fetched from the DB, or `undefined` will be returned. Likewise, For site reports and
 * nursery reports, the associated parent entity's id must be included.
 */
export async function getProjectId(entity: EntityModel) {
  if (entity instanceof Project) return entity.id;
  if (entity instanceof Site || entity instanceof Nursery || entity instanceof ProjectReport) return entity.projectId;

  const parentClass: ModelCtor<Site | Nursery> = entity instanceof SiteReport ? Site : Nursery;
  const parentId =
    entity instanceof SiteReport || entity instanceof DisturbanceReport
      ? entity.siteId
      : entity instanceof FinancialReport
      ? entity.organisationId
      : entity.nurseryId;
  return (await parentClass.findOne({ where: { id: parentId }, attributes: ["projectId"] }))?.projectId;
}

export async function getOrganisationId(entity: EntityModel) {
  if (entity instanceof Project) return entity.organisationId;

  return (await Project.findOne({ where: { id: await getProjectId(entity) }, attributes: ["organisationId"] }))
    ?.organisationId;
}

export function getViewLinkPath(entity: EntityModel) {
  const prefix = isReport(entity) ? "/reports/" : "/";
  return `${prefix}${kebabCase(entity.constructor.name)}/${entity.uuid}`;
}
