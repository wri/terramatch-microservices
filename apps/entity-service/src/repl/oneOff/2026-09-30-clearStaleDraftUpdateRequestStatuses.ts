import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { DRAFT, DUE } from "@terramatch-microservices/database/constants/status";
import {
  DisturbanceReport,
  FinancialReport,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  SrpReport,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";

const FIRST_REVIEW_STATUSES = [DRAFT, DUE];

type StatusEntity = Model & {
  id: number;
  status: string | null;
  updateRequestStatus: string | null;
};

type StatusEntityCtor = ModelCtor<StatusEntity> & { LARAVEL_TYPE: string; tableName: string };

type Bucket = {
  entities: number;
  updateRequests: number;
};

/**
 * Draft and due entities cannot have a change request. Clears a stale
 * update_request_status and soft-deletes any unapproved update request left behind.
 *
 * Run in entity-service REPL:
 *   await oneOff.clearStaleDraftUpdateRequestStatuses()
 *   await oneOff.clearStaleDraftUpdateRequestStatuses({ dryRun: false })
 *
 * Safe to re-run.
 */
export const clearStaleDraftUpdateRequestStatuses = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;
  const summary: Record<string, Bucket> = {
    [SiteReport.tableName]: await clearModel(SiteReport, dryRun),
    [ProjectReport.tableName]: await clearModel(ProjectReport, dryRun),
    [NurseryReport.tableName]: await clearModel(NurseryReport, dryRun),
    [SrpReport.tableName]: await clearModel(SrpReport, dryRun),
    [FinancialReport.tableName]: await clearModel(FinancialReport, dryRun),
    [DisturbanceReport.tableName]: await clearModel(DisturbanceReport, dryRun),
    [Project.tableName]: await clearModel(Project, dryRun),
    [Site.tableName]: await clearModel(Site, dryRun),
    [Nursery.tableName]: await clearModel(Nursery, dryRun)
  };

  console.log(JSON.stringify({ dryRun, summary }, null, 2));
  return { dryRun, summary };
});

const clearModel = async (model: StatusEntityCtor, dryRun: boolean): Promise<Bucket> => {
  const entities = await model.findAll({
    where: {
      status: { [Op.in]: FIRST_REVIEW_STATUSES },
      updateRequestStatus: { [Op.ne]: null }
    },
    attributes: ["id"]
  });
  if (entities.length === 0) return { entities: 0, updateRequests: 0 };

  const ids = entities.map(({ id }) => id);
  const updateRequestWhere = {
    updateRequestableType: model.LARAVEL_TYPE,
    updateRequestableId: ids,
    status: { [Op.ne]: "approved" }
  };

  if (dryRun) {
    return {
      entities: entities.length,
      updateRequests: await UpdateRequest.count({ where: updateRequestWhere })
    };
  }

  await model.update({ updateRequestStatus: null }, { where: { id: ids } });
  const updateRequests = await UpdateRequest.destroy({ where: updateRequestWhere });
  return { entities: entities.length, updateRequests };
};
