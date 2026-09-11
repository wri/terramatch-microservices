import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { clearNothingToReportData } from "@terramatch-microservices/common/events/processors/nothing-to-report.approval-processor";
import { NurseryReport, SiteReport } from "@terramatch-microservices/database/entities";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { ModelCtor } from "sequelize-typescript";
import ProgressBar from "progress";

type Options = {
  /** Default true. When true, only report how many reports would be cleaned. */
  dryRun?: boolean;
  batchSize?: number;
};

type CountBucket = {
  found: number;
  cleaned: number;
};

type Summary = {
  dryRun: boolean;
  siteReports: CountBucket;
  nurseryReports: CountBucket;
};

const emptyBucket = (): CountBucket => ({ found: 0, cleaned: 0 });

const processReports = async <T extends SiteReport | NurseryReport>(
  modelClass: ModelCtor<T>,
  dryRun: boolean,
  batchSize: number
): Promise<CountBucket> => {
  const bucket = emptyBucket();
  const builder = new PaginatedQueryBuilder(modelClass, batchSize).where({
    status: APPROVED,
    nothingToReport: true
  });

  const total = await builder.paginationTotal();
  bucket.found = total;
  if (total === 0) return bucket;

  const bar = new ProgressBar(`Processing ${total} ${modelClass.name} [:bar] :percent :etas`, {
    width: 40,
    total
  });

  for await (const page of batchFindAll(builder)) {
    for (const report of page) {
      if (!dryRun) await clearNothingToReportData(report as T);
      bucket.cleaned++;
      bar.tick();
    }
  }

  return bucket;
};

/**
 * Clears leftover form data from approved site and nursery reports that were submitted with
 * nothingToReport. New approvals are cleaned by NothingToReportApprovalProcessor; this backfills
 * reports that were approved before that processor existed.
 *
 * Usage:
 *   await oneOff.clearNothingToReportReports({ dryRun: true })
 *   await oneOff.clearNothingToReportReports({ dryRun: false })
 */
export const clearNothingToReportReports = withoutSqlLogs(async (opts: Options = {}) => {
  const dryRun = opts.dryRun ?? true;
  const batchSize = opts.batchSize ?? 100;

  const summary: Summary = {
    dryRun,
    siteReports: await processReports(SiteReport, dryRun, batchSize),
    nurseryReports: await processReports(NurseryReport, dryRun, batchSize)
  };

  console.log(`\nclearNothingToReportReports ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`  siteReports: found=${summary.siteReports.found} cleaned=${summary.siteReports.cleaned}`);
  console.log(`  nurseryReports: found=${summary.nurseryReports.found} cleaned=${summary.nurseryReports.cleaned}`);

  return summary;
});
