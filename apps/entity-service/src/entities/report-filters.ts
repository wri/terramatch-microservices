import {
  DisturbanceReport,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  SrpReport
} from "@terramatch-microservices/database/entities";
import { ReportClass, ReportModel } from "@terramatch-microservices/database/constants/entities";
import { ReportStatus } from "@terramatch-microservices/database/constants/status";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Attributes, ModelStatic } from "sequelize";
import { Literal } from "sequelize/types/utils";
import { DateTime } from "luxon";
import { ReportCountType } from "./dto/report-counts-query.dto";

export type ReportFilter = {
  // If non-empty, reports are limited to these frameworks
  frameworkKeys: string[];
  // If set, reports are limited to these projects
  projectIds?: number[] | Literal;
  statuses?: readonly ReportStatus[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  dueMonth?: number;
  dueYear?: number;
  search?: string;
};

type ReportFilterModel = {
  model: ReportClass<ReportModel>;
  parentAttribute: "projectId" | "siteId" | "nurseryId";
  // Returns the ids of parents (the attribute above) that belong to the given projects
  parentIdsInProjects: (projectIds: number[] | Literal) => number[] | Literal;
  // Returns the ids of parents whose own name or project name matches the search pattern
  parentIdsMatchingSearch: (pattern: string) => Literal;
};

const projectIdsMatchingSearch = (pattern: string) => Subquery.select(Project, "id").like("name", pattern).literal;

const projectChildIdsMatchingSearch = <M extends Site | Nursery>(model: ModelStatic<M>, pattern: string) => {
  const clauses = Subquery.clauseBuilder(model);
  return Subquery.select(model, "id").andLiteral(
    `(${clauses.like("name", pattern)} OR ${clauses.in("projectId", projectIdsMatchingSearch(pattern))})`
  ).literal;
};

const PROJECT_REPORT_FILTER = {
  parentAttribute: "projectId",
  parentIdsInProjects: projectIds => projectIds,
  parentIdsMatchingSearch: projectIdsMatchingSearch
} satisfies Omit<ReportFilterModel, "model">;

export const REPORT_FILTER_MODELS: Record<ReportCountType, ReportFilterModel> = {
  disturbanceReports: { model: DisturbanceReport, ...PROJECT_REPORT_FILTER },
  nurseryReports: {
    model: NurseryReport,
    parentAttribute: "nurseryId",
    parentIdsInProjects: projectIds => Nursery.idsSubquery(projectIds),
    parentIdsMatchingSearch: pattern => projectChildIdsMatchingSearch(Nursery, pattern)
  },
  projectReports: { model: ProjectReport, ...PROJECT_REPORT_FILTER },
  siteReports: {
    model: SiteReport,
    parentAttribute: "siteId",
    parentIdsInProjects: projectIds => Site.idsSubquery(projectIds),
    parentIdsMatchingSearch: pattern => projectChildIdsMatchingSearch(Site, pattern)
  },
  srpReports: { model: SrpReport, ...PROJECT_REPORT_FILTER }
};

/**
 * Builds a subquery of the ids of projects matching the filter's scoping, project and search
 * filters. A project matches the search if its name, or the name of one of its sites or nurseries,
 * matches. Report-specific filters (statuses, due dates) are not applied.
 */
export const filteredProjectsSubquery = ({ frameworkKeys, projectIds, search }: ReportFilter) => {
  const builder = Subquery.select(Project, "id");
  if (frameworkKeys.length > 0) builder.in("frameworkKey", frameworkKeys);
  if (projectIds != null) builder.in("id", projectIds);
  if (search != null) {
    const pattern = `%${search}%`;
    const siteProjectIds = Subquery.select(Site, "projectId").like("name", pattern).literal;
    const nurseryProjectIds = Subquery.select(Nursery, "projectId").like("name", pattern).literal;
    const { clauses } = builder;
    builder.andLiteral(
      `(${clauses.like("name", pattern)} OR ${clauses.in("id", siteProjectIds)} OR ${clauses.in("id", nurseryProjectIds)})`
    );
  }
  return builder;
};

/**
 * Builds a subquery selecting the given attribute from all reports of the given type that match
 * the filter.
 */
export const filteredReportsSubquery = (type: ReportCountType, select: "id" | "parent", filter: ReportFilter) => {
  const { model, parentAttribute, parentIdsInProjects, parentIdsMatchingSearch } = REPORT_FILTER_MODELS[type];
  // The parent attribute is not common to all report models, so TS can't verify it against the union.
  const parent = parentAttribute as keyof Attributes<ReportModel>;
  const builder = Subquery.select(model, select === "id" ? "id" : parent);
  const { clauses } = builder;

  if (filter.frameworkKeys.length > 0) builder.in("frameworkKey", filter.frameworkKeys);
  if (filter.statuses != null && filter.statuses.length > 0) builder.in("status", [...filter.statuses]);
  if (filter.dueDateFrom != null) builder.gte("dueAt", filter.dueDateFrom);
  if (filter.dueDateTo != null) {
    // dueDateTo is a date, so include the entire day.
    builder.lt("dueAt", DateTime.fromJSDate(filter.dueDateTo, { zone: "utc" }).plus({ days: 1 }).toJSDate());
  }
  if (filter.dueMonth != null) {
    builder.andLiteral(`MONTH(${clauses.field("dueAt")}) = ${clauses.escape(filter.dueMonth)}`);
  }
  if (filter.dueYear != null) {
    builder.andLiteral(`YEAR(${clauses.field("dueAt")}) = ${clauses.escape(filter.dueYear)}`);
  }
  if (filter.projectIds != null) builder.in(parent, parentIdsInProjects(filter.projectIds));
  if (filter.search != null) builder.in(parent, parentIdsMatchingSearch(`%${filter.search}%`));

  return builder;
};
