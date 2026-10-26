import {
  DisturbanceReport,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  SrpReport,
  Task
} from "@terramatch-microservices/database/entities";
import { ReportClass, ReportModel } from "@terramatch-microservices/database/constants/entities";
import {
  INFORMATION_REQUIRED,
  PENDING_APPROVAL,
  ReportStatus,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
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
  // Matched against the status shown for the report (see SUBMITTED_UPDATE_REQUEST_STATUSES)
  statuses?: readonly ReportStatus[];
  // Matched against the report's update request status. Reports without one never match.
  updateRequestStatuses?: readonly UpdateRequestStatus[];
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
  // Returns the ids of the projects that the given parents belong to
  projectIdsForParents: (parentIds: Literal) => Literal;
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
  projectIdsForParents: parentIds => parentIds,
  parentIdsMatchingSearch: projectIdsMatchingSearch
} satisfies Omit<ReportFilterModel, "model">;

export const REPORT_FILTER_MODELS: Record<ReportCountType, ReportFilterModel> = {
  disturbanceReports: { model: DisturbanceReport, ...PROJECT_REPORT_FILTER },
  nurseryReports: {
    model: NurseryReport,
    parentAttribute: "nurseryId",
    parentIdsInProjects: projectIds => Nursery.idsSubquery(projectIds),
    projectIdsForParents: parentIds => Subquery.select(Nursery, "projectId").in("id", parentIds).literal,
    parentIdsMatchingSearch: pattern => projectChildIdsMatchingSearch(Nursery, pattern)
  },
  projectReports: { model: ProjectReport, ...PROJECT_REPORT_FILTER },
  siteReports: {
    model: SiteReport,
    parentAttribute: "siteId",
    parentIdsInProjects: projectIds => Site.idsSubquery(projectIds),
    projectIdsForParents: parentIds => Subquery.select(Site, "projectId").in("id", parentIds).literal,
    parentIdsMatchingSearch: pattern => projectChildIdsMatchingSearch(Site, pattern)
  },
  srpReports: { model: SrpReport, ...PROJECT_REPORT_FILTER }
};

// A report with a submitted change request is shown with the change request's status instead of
// its own, so the status filter matches on that (the FE resolves the status the same way).
const SUBMITTED_UPDATE_REQUEST_STATUSES = [PENDING_APPROVAL, INFORMATION_REQUIRED];

// The progress reports are listed through their tasks (see TasksService.getTasks), which leaves out deleted tasks and the
// tasks of deleted projects or organisations. The counts have to leave out the same reports, or they won't match the list.
const TASK_REPORT_TYPES: readonly ReportCountType[] = ["nurseryReports", "projectReports", "siteReports"];

const listedTasksSubquery = () =>
  Subquery.select(Task, "id")
    .in("projectId", Subquery.select(Project, "id").literal)
    .in("organisationId", Subquery.select(Organisation, "id").literal).literal;

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
  if (TASK_REPORT_TYPES.includes(type)) builder.in("taskId" as keyof Attributes<ReportModel>, listedTasksSubquery());
  if (filter.statuses != null && filter.statuses.length > 0) {
    const isSubmitted = clauses.in("updateRequestStatus", SUBMITTED_UPDATE_REQUEST_STATUSES);
    const shownStatus = `IF(${isSubmitted}, ${clauses.field("updateRequestStatus")}, ${clauses.field("status")})`;
    const statuses = filter.statuses.map(status => clauses.escape(status)).join(",");
    builder.andLiteral(`${shownStatus} IN (${statuses})`);
  }
  if (filter.updateRequestStatuses != null && filter.updateRequestStatuses.length > 0) {
    builder.in("updateRequestStatus", [...filter.updateRequestStatuses]);
  }
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

/**
 * Builds a subquery of the ids of projects with at least one report of the given (non-empty) types
 * matching the filter.
 */
export const filteredProjectsSubquery = (types: readonly ReportCountType[], filter: ReportFilter) => {
  const builder = Subquery.select(Project, "id");
  const matches = types.map(type => {
    const parentIds = filteredReportsSubquery(type, "parent", filter).literal;
    return builder.clauses.in("id", REPORT_FILTER_MODELS[type].projectIdsForParents(parentIds));
  });
  return builder.andLiteral(`(${matches.join(" OR ")})`);
};
