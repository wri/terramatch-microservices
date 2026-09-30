import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { REPORT_MODELS, ReportClass, ReportModel } from "@terramatch-microservices/database/constants/entities";
import { DRAFT, PENDING_APPROVAL } from "@terramatch-microservices/database/constants/status";
import { UpdateRequest } from "@terramatch-microservices/database/entities";
import { chunk } from "lodash";
import { Op } from "sequelize";

const CHUNK_SIZE = 1000;

type Bucket = {
  checked: number;
  cleared: number;
};

/**
 * A draft report with updateRequestStatus pending-approval and no current change request
 * has a stale denormalized field. Sets that field back to null.
 *
 * A current change request is the latest unapproved UpdateRequest, the same row
 * UpdateRequest.for(report).current().findOne() would return.
 *
 * Run in entity-service REPL:
 *   await oneOff.clearStaleDraftUpdateRequestStatuses()
 *   await oneOff.clearStaleDraftUpdateRequestStatuses({ dryRun: false })
 *
 * Safe to re-run.
 */
export const clearStaleDraftUpdateRequestStatuses = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;
  const summary: Record<string, Bucket> = {};

  for (const [reportType, model] of Object.entries(REPORT_MODELS)) {
    summary[reportType] = await clearReport(model, dryRun);
  }

  console.log(JSON.stringify({ dryRun, summary }, null, 2));
  return { dryRun, summary };
});

const clearReport = async (model: ReportClass<ReportModel>, dryRun: boolean): Promise<Bucket> => {
  const reports = await model.findAll({
    where: { status: DRAFT, updateRequestStatus: PENDING_APPROVAL },
    attributes: ["id"]
  });
  if (reports.length === 0) return { checked: 0, cleared: 0 };

  const idsWithChangeRequest = new Set<number>();
  for (const idChunk of chunk(
    reports.map(({ id }) => id),
    CHUNK_SIZE
  )) {
    const updateRequests = await UpdateRequest.findAll({
      where: {
        updateRequestableType: model.LARAVEL_TYPE,
        updateRequestableId: idChunk,
        status: { [Op.ne]: "approved" }
      },
      attributes: ["updateRequestableId"]
    });
    for (const updateRequest of updateRequests) {
      if (updateRequest.updateRequestableId != null) idsWithChangeRequest.add(updateRequest.updateRequestableId);
    }
  }

  const staleIds = reports.map(({ id }) => id).filter(id => !idsWithChangeRequest.has(id));
  if (!dryRun && staleIds.length > 0) {
    for (const idChunk of chunk(staleIds, CHUNK_SIZE)) {
      await model.update({ updateRequestStatus: null }, { where: { id: idChunk }, hooks: false });
    }
  }

  return { checked: reports.length, cleared: staleIds.length };
};
