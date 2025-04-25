import { Nursery, NurseryReport, Project, ProjectReport, Site, SiteReport } from "../entities";
import { ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";
import { kebabCase } from "lodash";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";
import { Invasive } from "@terramatch-microservices/database/entities/invasive.entity";

export const REPORT_TYPES = ["projectReports", "siteReports", "nurseryReports"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportModel = ProjectReport | SiteReport | NurseryReport;
export type ReportClass<T extends ReportModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const REPORT_MODELS: { [R in ReportType]: ReportClass<ReportModel> } = {
  projectReports: ProjectReport,
  siteReports: SiteReport,
  nurseryReports: NurseryReport
};

export const ENTITY_TYPES = ["projects", "sites", "nurseries", "disturbances", "invasives", ...REPORT_TYPES] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type EntityModel = ReportModel | Project | Site | Nursery | Disturbance | Invasive;
export type EntityClass<T extends EntityModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };
export const ENTITY_MODELS: { [E in EntityType]: EntityClass<EntityModel> } = {
  ...REPORT_MODELS,
  projects: Project,
  sites: Site,
  nurseries: Nursery,
  disturbances: Disturbance,
  // stratas:  Strata::class,
  invasives: Invasive
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
  if (entity instanceof Disturbance) return entity.id;
  if (entity instanceof Invasive) return entity.id;
  if (entity instanceof Site || entity instanceof Nursery || entity instanceof ProjectReport) return entity.projectId;

  const parentClass: ModelCtor<Site | Nursery> = entity instanceof SiteReport ? Site : Nursery;
  const parentId = entity instanceof SiteReport ? entity.siteId : entity.nurseryId;
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
