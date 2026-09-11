import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Task } from "@terramatch-microservices/database/entities";
import { chunk } from "lodash";
import { QueryTypes, Transaction } from "sequelize";

const TERRAFUND_DUE_AT_FRAMEWORKS = [
  "terrafund",
  "terrafund-landscapes",
  "terrafund-3",
  "enterprises",
  "epa-ghana-pilot"
] as const;

const ALIGN_DUE_AT_FRAMEWORKS = ["ppc", "hbf", ...TERRAFUND_DUE_AT_FRAMEWORKS] as const;
const HBF_JUNE_SHIFT_DATES = ["2025-06-03", "2025-06-30", "2026-06-01"] as const;

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatSqlDateTime = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)} 00:00:00`;

const resolveAlignedDueAt = (frameworkKey: string, dueAtSql: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueAtSql.trim());
  if (match == null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthDay = `${pad2(month)}-${pad2(day)}`;
  const date = `${year}-${pad2(month)}-${pad2(day)}`;

  if (frameworkKey === "ppc") return formatSqlDateTime(year, month, 7);

  if ((TERRAFUND_DUE_AT_FRAMEWORKS as readonly string[]).includes(frameworkKey)) {
    if (monthDay === "07-30") return formatSqlDateTime(year, 7, 31);
    if (monthDay === "01-30" || monthDay === "02-01") return formatSqlDateTime(year, 1, 31);
    return null;
  }

  if (frameworkKey === "hbf") {
    if (monthDay === "12-01") return formatSqlDateTime(year, 11, 30);
    if ((HBF_JUNE_SHIFT_DATES as readonly string[]).includes(date)) return formatSqlDateTime(year, 5, 31);
    return null;
  }

  return null;
};

type AlignTaskReportDueAtOptions = {
  /** Default true. When true, only report what would change. */
  dryRun?: boolean;
};

type TaskDueAtRow = {
  id: number;
  dueAtSql: string;
  frameworkKey: string;
};

type ReportDueAtRow = {
  id: number;
  taskId: number | null;
  dueAtSql: string;
  frameworkKey: string;
};

type CountBucket = {
  scanned: number;
  updated: number;
  skipped: number;
};

type AlignSummary = {
  dryRun: boolean;
  tasks: CountBucket;
  projectReports: CountBucket;
  siteReports: CountBucket;
  nurseryReports: CountBucket;
  srpReports: CountBucket;
  samples: string[];
};

const REPORT_TABLES = [
  { label: "projectReports" as const, table: "v2_project_reports" },
  { label: "siteReports" as const, table: "v2_site_reports" },
  { label: "nurseryReports" as const, table: "v2_nursery_reports" },
  { label: "srpReports" as const, table: "srp_reports" }
];

const ID_CHUNK_SIZE = 500;
const SAMPLE_LIMIT = 25;

const emptyBucket = (): CountBucket => ({ scanned: 0, updated: 0, skipped: 0 });

const sequelizeOf = () => {
  const sequelize = Task.sequelize;
  if (sequelize == null) throw new Error("Task sequelize instance not available");
  return sequelize;
};

const loadTasks = async (transaction?: Transaction): Promise<TaskDueAtRow[]> => {
  return sequelizeOf().query<TaskDueAtRow>(
    `SELECT
       t.id,
       DATE_FORMAT(t.due_at, '%Y-%m-%d %H:%i:%s') AS dueAtSql,
       p.framework_key AS frameworkKey
     FROM v2_tasks t
     INNER JOIN v2_projects p ON p.id = t.project_id
     WHERE t.deleted_at IS NULL
       AND t.due_at IS NOT NULL
       AND p.framework_key IN (:frameworkKeys)
     ORDER BY t.id`,
    {
      replacements: { frameworkKeys: [...ALIGN_DUE_AT_FRAMEWORKS] },
      type: QueryTypes.SELECT,
      transaction
    }
  );
};

const loadReports = async (
  table: string,
  alignedTaskIds: number[],
  transaction?: Transaction
): Promise<ReportDueAtRow[]> => {
  const replacements: { frameworkKeys: string[]; alignedTaskIds?: number[] } = {
    frameworkKeys: [...ALIGN_DUE_AT_FRAMEWORKS]
  };
  const taskIdClause = alignedTaskIds.length > 0 ? "OR r.task_id IN (:alignedTaskIds)" : "";
  if (alignedTaskIds.length > 0) replacements.alignedTaskIds = alignedTaskIds;

  return sequelizeOf().query<ReportDueAtRow>(
    `SELECT
       r.id,
       r.task_id AS taskId,
       DATE_FORMAT(r.due_at, '%Y-%m-%d %H:%i:%s') AS dueAtSql,
       r.framework_key AS frameworkKey
     FROM \`${table}\` r
     WHERE r.deleted_at IS NULL
       AND r.due_at IS NOT NULL
       AND (r.framework_key IN (:frameworkKeys) ${taskIdClause})
     ORDER BY r.id`,
    {
      replacements,
      type: QueryTypes.SELECT,
      transaction
    }
  );
};

const updateDueAtByIds = async (
  table: string,
  ids: number[],
  dueAtSql: string,
  dryRun: boolean,
  transaction?: Transaction
) => {
  if (dryRun || ids.length === 0) return;

  for (const idChunk of chunk(ids, ID_CHUNK_SIZE)) {
    await sequelizeOf().query(`UPDATE \`${table}\` SET due_at = :dueAtSql WHERE id IN (:ids) AND deleted_at IS NULL`, {
      replacements: { dueAtSql, ids: idChunk },
      type: QueryTypes.UPDATE,
      transaction
    });
  }
};

const groupIdsByTarget = (rows: Array<{ id: number; dueAtSql: string; frameworkKey: string; target: string }>) => {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const ids = grouped.get(row.target) ?? [];
    ids.push(row.id);
    grouped.set(row.target, ids);
  }
  return grouped;
};

const pushSample = (samples: string[], line: string) => {
  if (samples.length < SAMPLE_LIMIT) samples.push(line);
};

/**
 * Aligns historical task/report due_at values that drifted off the intended calendar day.
 *
 * PPC: day → 7th of the same month at 00:00:00 (including monthly reports before 2023-04).
 * TerraFund family: 07-30 → 07-31; 01-30 or 02-01 → 01-31.
 * HBF: 12-01 → 11-30; listed June dates → 05-31.
 *
 * After each task due_at is updated, linked reports are set to the same due_at.
 * Reports that still match a drift rule (task already correct, or no task) are aligned independently.
 *
 * Usage:
 *   await oneOff.alignTaskReportDueAt({ dryRun: true })
 *   await oneOff.alignTaskReportDueAt({ dryRun: false })
 */
export const alignTaskReportDueAt = withoutSqlLogs(async (opts: AlignTaskReportDueAtOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const sequelize = sequelizeOf();

  const summary: AlignSummary = {
    dryRun,
    tasks: emptyBucket(),
    projectReports: emptyBucket(),
    siteReports: emptyBucket(),
    nurseryReports: emptyBucket(),
    srpReports: emptyBucket(),
    samples: []
  };

  const run = async (transaction?: Transaction) => {
    const tasks = await loadTasks(transaction);
    const taskTargets = new Map<number, string>();
    const taskUpdates: Array<TaskDueAtRow & { target: string }> = [];

    for (const task of tasks) {
      summary.tasks.scanned++;

      const target = resolveAlignedDueAt(task.frameworkKey, task.dueAtSql);
      if (target == null || target === task.dueAtSql) {
        summary.tasks.skipped++;
        continue;
      }

      taskTargets.set(task.id, target);
      taskUpdates.push({ ...task, target });
      summary.tasks.updated++;
      pushSample(summary.samples, `task ${task.id} [${task.frameworkKey}] ${task.dueAtSql} -> ${target}`);
    }

    for (const [target, ids] of groupIdsByTarget(taskUpdates)) {
      await updateDueAtByIds("v2_tasks", ids, target, dryRun, transaction);
    }

    const alignedTaskIds = [...taskTargets.keys()];

    for (const { label, table } of REPORT_TABLES) {
      const reports = await loadReports(table, alignedTaskIds, transaction);
      const reportUpdates: Array<ReportDueAtRow & { target: string }> = [];

      for (const report of reports) {
        summary[label].scanned++;

        const taskTarget = report.taskId == null ? null : (taskTargets.get(report.taskId) ?? null);
        const target = taskTarget ?? resolveAlignedDueAt(report.frameworkKey, report.dueAtSql);
        if (target == null || target === report.dueAtSql) {
          summary[label].skipped++;
          continue;
        }

        reportUpdates.push({ ...report, target });
        summary[label].updated++;
        pushSample(
          summary.samples,
          `${label} ${report.id} (task ${report.taskId ?? "none"}) [${report.frameworkKey}] ${report.dueAtSql} -> ${target}`
        );
      }

      for (const [target, ids] of groupIdsByTarget(reportUpdates)) {
        await updateDueAtByIds(table, ids, target, dryRun, transaction);
      }
    }
  };

  if (dryRun) {
    await run();
  } else {
    await sequelize.transaction(async transaction => run(transaction));
  }

  console.log(`\nalignTaskReportDueAt ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(
    `  tasks: scanned=${summary.tasks.scanned} updated=${summary.tasks.updated} skipped=${summary.tasks.skipped}`
  );
  for (const { label } of REPORT_TABLES) {
    const bucket = summary[label];
    console.log(`  ${label}: scanned=${bucket.scanned} updated=${bucket.updated} skipped=${bucket.skipped}`);
  }
  if (summary.samples.length > 0) {
    console.log("  samples:");
    for (const sample of summary.samples) {
      console.log(`    ${sample}`);
    }
  }

  return summary;
});
