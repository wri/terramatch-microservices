import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { syncDisturbanceReportPolygons } from "@terramatch-microservices/common/events/processors/disturbance-report-entry.approval-processor";
import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import { APPROVED, INFORMATION_REQUIRED, PENDING_APPROVAL } from "@terramatch-microservices/database/constants/status";
import { Op } from "sequelize";

type ResyncDisturbancePolygonLinksOptions = {
  dryRun?: boolean;
  reportUuids?: string[];
};

const NON_DRAFT_STATUSES = [PENDING_APPROVAL, INFORMATION_REQUIRED, APPROVED] as const;

export const resyncDisturbancePolygonLinks = withoutSqlLogs(async (opts: ResyncDisturbancePolygonLinksOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const reportUuids = opts.reportUuids;

  console.log(`\nresync:disturbance-polygon-links ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);

  const reports = await DisturbanceReport.findAll({
    where: {
      status: { [Op.in]: [...NON_DRAFT_STATUSES] },
      ...(reportUuids != null && reportUuids.length > 0 ? { uuid: { [Op.in]: reportUuids } } : {})
    },
    attributes: ["id", "uuid", "status", "submittedAt", "description", "actionDescription"],
    // Oldest first so later syncs overwrite disturbance_id onto the latest report.
    order: [
      ["submittedAt", "ASC"],
      ["id", "ASC"]
    ]
  });

  console.log(`Found ${reports.length} non-draft disturbance report(s) to sync.`);

  let synced = 0;
  for (const report of reports) {
    console.log(
      `  ${dryRun ? "would sync" : "syncing"} report ${report.uuid} (id=${report.id}, status=${report.status}, submittedAt=${report.submittedAt?.toISOString() ?? "null"})`
    );
    if (!dryRun) {
      await syncDisturbanceReportPolygons(report);
      synced += 1;
    }
  }

  console.log(
    dryRun ? `\nDry run complete. Re-run with { dryRun: false } to apply.` : `\nSynced ${synced} disturbance report(s).`
  );

  return { dryRun, total: reports.length, synced };
});
