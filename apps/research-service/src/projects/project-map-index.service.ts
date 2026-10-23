import { Injectable } from "@nestjs/common";
import { col, fn, Op } from "sequelize";
import { AuditStatus, Project, SitePolygon } from "@terramatch-microservices/database/entities";
import {
  isProjectQaStatus,
  PROJECT_QA_STATUS_AUDIT_TYPES,
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
  sumNumTrees: number | string;
  sumCalcArea: number | string;
};

type PolygonAggregates = { polygonCount: number; sumNumTrees: number; sumCalcArea: number };

type LatestQaStatus = { latestQaCycle: number | null; latestQaStatus: ProjectQaStatus | null };

const NO_POLYGONS: PolygonAggregates = { polygonCount: 0, sumNumTrees: 0, sumCalcArea: 0 };

const NO_QA_STATUS: LatestQaStatus = { latestQaCycle: null, latestQaStatus: null };

const aggregateActivePolygonsByProject = async (projectIds: ProjectIdsSubquery) => {
  const rows = (await SitePolygon.findAll({
    attributes: [
      [col("site.project_id"), "projectId"],
      [fn("COUNT", col("SitePolygon.id")), "count"],
      [fn("COALESCE", fn("SUM", col("SitePolygon.num_trees")), 0), "sumNumTrees"],
      [fn("COALESCE", fn("SUM", col("SitePolygon.calc_area")), 0), "sumCalcArea"]
    ],
    include: [{ association: "site", attributes: [], required: true, where: { projectId: { [Op.in]: projectIds } } }],
    where: { isActive: true },
    group: ["site.project_id"],
    raw: true
  })) as unknown as PolygonAggregateRow[];
  return new Map(
    rows.map(({ projectId, count, sumNumTrees, sumCalcArea }) => [
      Number(projectId),
      { polygonCount: Number(count), sumNumTrees: Number(sumNumTrees), sumCalcArea: Number(sumCalcArea) }
    ])
  );
};

/**
 * The QA status of the most recently updated reporting cycle, read from the QA status audit of each project with the
 * latest `updatedAt`. Cycles saved together share that timestamp, so the last audit written (highest id) wins the tie.
 * A cleared status (null) on that audit means there is nothing to show.
 */
const findLatestQaStatusByProject = async (projectIds: ProjectIdsSubquery) => {
  const latestUpdates = Subquery.select(AuditStatus, "updatedAt", {
    aggregate: { sqlFn: "MAX", groupColumn: "auditableId", as: "latestUpdatedAt" },
    additional: ["auditableId"]
  })
    .eq("auditableType", Project.LARAVEL_TYPE)
    .in("type", [...PROJECT_QA_STATUS_AUDIT_TYPES])
    .in("auditableId", projectIds).literal;
  const latestAuditIds = Subquery.select(AuditStatus, "id")
    .innerJoin(
      latestUpdates,
      "latestQaAudit",
      "`latestQaAudit`.`latestUpdatedAt` = `audit_statuses`.`updated_at` AND `latestQaAudit`.`auditable_id` = `audit_statuses`.`auditable_id`"
    )
    .eq("auditableType", Project.LARAVEL_TYPE)
    .in("type", [...PROJECT_QA_STATUS_AUDIT_TYPES]).literal;
  const audits = await AuditStatus.findAll({
    attributes: ["auditableId", "type", "status"],
    where: { id: { [Op.in]: latestAuditIds } },
    order: [["id", "ASC"]]
  });

  const latest = new Map<number, LatestQaStatus>();
  for (const { auditableId, type, status } of audits) {
    const latestQaCycle = PROJECT_QA_STATUS_AUDIT_TYPES.findIndex(qaType => qaType === type) + 1;
    latest.set(auditableId, isProjectQaStatus(status) ? { latestQaCycle, latestQaStatus: status } : NO_QA_STATUS);
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
