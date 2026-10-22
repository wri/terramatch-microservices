import { Injectable } from "@nestjs/common";
import { col, fn, Op } from "sequelize";
import { AuditStatus, Project, SitePolygon } from "@terramatch-microservices/database/entities";
import {
  PROJECT_QA_STATUS_AUDIT_TYPES,
  PROJECT_QA_STATUS_VALUES,
  ProjectQaStatus
} from "@terramatch-microservices/database/constants";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { projectContextIdsSubquery } from "../site-polygons/project-context-filters";
import { ProjectMapIndexQueryDto } from "./dto/project-map-index-query.dto";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";

type ProjectIdsSubquery = ReturnType<typeof projectContextIdsSubquery>;

type PolygonAggregateRow = {
  projectId: number;
  count: number | string;
  sumNumTrees: number | string | null;
  sumCalcArea: number | string | null;
};

type PolygonAggregates = { polygonCount: number; sumNumTrees: number; sumCalcArea: number };

type LatestQaStatus = { latestQaCycle: number; latestQaStatus: ProjectQaStatus };

const NO_POLYGONS: PolygonAggregates = { polygonCount: 0, sumNumTrees: 0, sumCalcArea: 0 };

const NO_QA_STATUS = { latestQaCycle: null, latestQaStatus: null };

const isProjectQaStatus = (status: string | null): status is ProjectQaStatus =>
  PROJECT_QA_STATUS_VALUES.includes(status as ProjectQaStatus);

const aggregateActivePolygonsByProject = async (projectIds: ProjectIdsSubquery) => {
  const rows = (await SitePolygon.findAll({
    attributes: [
      [col("site.project_id"), "projectId"],
      [fn("COUNT", col("SitePolygon.id")), "count"],
      [fn("SUM", col("SitePolygon.num_trees")), "sumNumTrees"],
      [fn("SUM", col("SitePolygon.calc_area")), "sumCalcArea"]
    ],
    include: [{ association: "site", attributes: [], required: true, where: { projectId: { [Op.in]: projectIds } } }],
    where: { isActive: true },
    group: ["site.project_id"],
    raw: true
  })) as unknown as PolygonAggregateRow[];
  return new Map(
    rows.map(({ projectId, count, sumNumTrees, sumCalcArea }) => [
      Number(projectId),
      { polygonCount: Number(count), sumNumTrees: Number(sumNumTrees ?? 0), sumCalcArea: Number(sumCalcArea ?? 0) }
    ])
  );
};

/**
 * The QA status of the most recently updated reporting cycle, read from the newest QA status audit of each project.
 * A cleared status (null) on that newest audit means there is nothing to show.
 */
const findLatestQaStatusByProject = async (projectIds: ProjectIdsSubquery) => {
  const latestAuditIds = Subquery.select(AuditStatus, "id", { aggregate: { sqlFn: "MAX", groupColumn: "auditableId" } })
    .eq("auditableType", Project.LARAVEL_TYPE)
    .in("type", [...PROJECT_QA_STATUS_AUDIT_TYPES])
    .in("auditableId", projectIds).literal;
  const audits = await AuditStatus.findAll({
    attributes: ["auditableId", "type", "status"],
    where: { id: { [Op.in]: latestAuditIds } }
  });

  const latest = new Map<number, LatestQaStatus>();
  for (const { auditableId, type, status } of audits) {
    if (!isProjectQaStatus(status)) continue;

    const cycleIndex = PROJECT_QA_STATUS_AUDIT_TYPES.findIndex(qaType => qaType === type);
    latest.set(auditableId, { latestQaCycle: cycleIndex + 1, latestQaStatus: status });
  }
  return latest;
};

@Injectable()
export class ProjectMapIndexService {
  async getMapIndex(query: ProjectMapIndexQueryDto) {
    const projectIds = projectContextIdsSubquery(query, true);
    const [projects, polygonAggregates, latestQaStatuses] = await Promise.all([
      Project.findAll({
        attributes: ["id", "uuid", "name", "lat", "long", "frameworkKey", "level0Project", "cohort"],
        where: { id: { [Op.in]: projectIds } }
      }),
      aggregateActivePolygonsByProject(projectIds),
      findLatestQaStatusByProject(projectIds)
    ]);

    return new ProjectMapIndexDto(
      projects.map(({ id, uuid, name, lat, long, frameworkKey, level0Project, cohort }) => ({
        uuid,
        name,
        lat,
        long,
        frameworkKey,
        level0Project,
        cohort,
        ...(polygonAggregates.get(id) ?? NO_POLYGONS),
        ...(latestQaStatuses.get(id) ?? NO_QA_STATUS)
      }))
    );
  }
}
