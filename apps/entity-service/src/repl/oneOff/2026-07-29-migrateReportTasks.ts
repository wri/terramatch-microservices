import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assertNotNull, assertNumber } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { NurseryReport, ProjectReport, SiteReport, SrpReport, Task } from "@terramatch-microservices/database/entities";
import { Dictionary } from "lodash";
import { Model, ModelStatic, Transaction } from "sequelize";

type ReportTaskMigrationRow = {
  reportId: number;
  currentTaskId: number;
  migratedTaskId: number;
};

type TaskDeletionTarget = {
  id: number;
  uuid: string;
  projectId: number;
};

type MigrationCounts = {
  updated: number;
  skipped: number;
  errors: string[];
};

type ReportModel = Model & {
  id: number;
  taskId: number | null;
};

type MigrateReportTasksOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  projectReportsCsvPath?: string;
  siteReportsCsvPath?: string;
  nurseryReportsCsvPath?: string;
  srpReportsCsvPath?: string;
  deleteTasksCsvPath?: string;
};

const TM_3762_PROJECT_REPORTS_CSV_PATH = "tm_3762_project_report_task_migration.csv";
const TM_3762_SITE_REPORTS_CSV_PATH = "tm_3762_site_report_task_migration.csv";
const TM_3762_NURSERY_REPORTS_CSV_PATH = "tm_3762_nursery_report_task_migration.csv";
const TM_3762_SRP_REPORTS_CSV_PATH = "tm_3762_srp_report_task_migration.csv";
const TM_3762_DELETE_TASKS_CSV_PATH = "tm_3762_delete_task.csv";

const MIGRATION_COLUMN_PATTERNS = {
  migratedTaskId: /^migrated .*task_id$/i,
  currentTaskId: /^current .*task_id$/i,
  reportId: /reports\.id$/i
} as const;

const findColumnKey = (row: Dictionary<string>, role: keyof typeof MIGRATION_COLUMN_PATTERNS): string => {
  const key = Object.keys(row).find(columnName => MIGRATION_COLUMN_PATTERNS[role].test(columnName.trim()));
  return assertNotNull(key, `Could not find CSV column for ${role}`);
};

const parseMigrationRow = (row: Dictionary<string>): ReportTaskMigrationRow => ({
  migratedTaskId: assertNumber(columnValue(row, findColumnKey(row, "migratedTaskId")), "migrated task id is required"),
  currentTaskId: assertNumber(columnValue(row, findColumnKey(row, "currentTaskId")), "current task id is required"),
  reportId: assertNumber(columnValue(row, findColumnKey(row, "reportId")), "report id is required")
});

const DELETE_TASK_COLUMN_PATTERNS = {
  id: /^v2_tasks\.id$/i,
  uuid: /^v2_tasks\.uuid$/i,
  projectId: /^v2_tasks\.project_id$/i
} as const;

const findDeleteTaskColumnKey = (row: Dictionary<string>, role: keyof typeof DELETE_TASK_COLUMN_PATTERNS): string => {
  const key = Object.keys(row).find(columnName => DELETE_TASK_COLUMN_PATTERNS[role].test(columnName.trim()));
  return assertNotNull(key, `Could not find CSV column for task ${role}`);
};

const parseDeleteTaskRow = (row: Dictionary<string>): TaskDeletionTarget => ({
  id: assertNumber(columnValue(row, findDeleteTaskColumnKey(row, "id")), "task id is required"),
  uuid: assertNotNull(columnValue(row, findDeleteTaskColumnKey(row, "uuid")), "task uuid is required"),
  projectId: assertNumber(columnValue(row, findDeleteTaskColumnKey(row, "projectId")), "task project id is required")
});

const loadMigrationRows = async (csvPath: string): Promise<ReportTaskMigrationRow[]> => {
  const rows: ReportTaskMigrationRow[] = [];
  await parseCsv(csvPath, async row => {
    rows.push(parseMigrationRow(row));
  });
  return rows;
};

const countReportsForTask = async (taskId: number, transaction?: Transaction) => {
  const [projectReports, siteReports, nurseryReports, srpReports] = await Promise.all([
    ProjectReport.count({ where: { taskId }, transaction }),
    SiteReport.count({ where: { taskId }, transaction }),
    NurseryReport.count({ where: { taskId }, transaction }),
    SrpReport.count({ where: { taskId }, transaction })
  ]);

  return projectReports + siteReports + nurseryReports + srpReports;
};

const migrateReports = async (
  label: string,
  model: ModelStatic<ReportModel>,
  targets: ReportTaskMigrationRow[],
  dryRun: boolean,
  transaction?: Transaction
): Promise<MigrationCounts> => {
  const counts: MigrationCounts = { updated: 0, skipped: 0, errors: [] };

  for (const target of targets) {
    const report = await model.findOne({
      where: { id: target.reportId },
      attributes: ["id", "taskId"],
      transaction
    });

    if (report == null) {
      counts.errors.push(`${label} id=${target.reportId}: record not found`);
      counts.skipped++;
      continue;
    }

    if (report.taskId === target.migratedTaskId) {
      console.log(`${label} id=${target.reportId}: already linked to task ${target.migratedTaskId} — skipping`);
      counts.skipped++;
      continue;
    }

    if (report.taskId !== target.currentTaskId) {
      counts.errors.push(
        `${label} id=${target.reportId}: taskId mismatch (expected ${target.currentTaskId}, found ${report.taskId})`
      );
      counts.skipped++;
      continue;
    }

    const migratedTask = await Task.findByPk(target.migratedTaskId, {
      attributes: ["id"],
      paranoid: false,
      transaction
    });

    if (migratedTask == null) {
      counts.errors.push(`${label} id=${target.reportId}: target task ${target.migratedTaskId} not found`);
      counts.skipped++;
      continue;
    }

    console.log(`${label} id=${target.reportId}: taskId ${target.currentTaskId} -> ${target.migratedTaskId}`);

    if (!dryRun) {
      await report.update({ taskId: target.migratedTaskId }, { transaction });
    }

    counts.updated++;
  }

  return counts;
};

const deleteTask = async (
  target: TaskDeletionTarget,
  dryRun: boolean,
  transaction: Transaction | undefined,
  counts: MigrationCounts
) => {
  const task = await Task.findOne({
    where: { id: target.id },
    attributes: ["id", "uuid", "projectId", "deletedAt"],
    paranoid: false,
    transaction
  });

  if (task == null) {
    counts.errors.push(`Task id=${target.id}: record not found`);
    counts.skipped++;
    return;
  }

  if (task.deletedAt != null) {
    console.log(`Task id=${target.id}: already deleted — skipping`);
    counts.skipped++;
    return;
  }

  if (task.uuid !== target.uuid) {
    counts.errors.push(`Task id=${target.id}: uuid mismatch (expected ${target.uuid}, found ${task.uuid})`);
    counts.skipped++;
    return;
  }

  if (task.projectId !== target.projectId) {
    counts.errors.push(
      `Task id=${target.id}: projectId mismatch (expected ${target.projectId}, found ${task.projectId})`
    );
    counts.skipped++;
    return;
  }

  const linkedReports = await countReportsForTask(target.id, transaction);
  if (linkedReports > 0) {
    counts.errors.push(`Task id=${target.id}: still has ${linkedReports} linked report(s)`);
    counts.skipped++;
    return;
  }

  console.log(`Task id=${target.id} (${target.uuid}): deleting duplicate reporting task`);

  if (!dryRun) {
    await task.destroy({ transaction });
  }

  counts.updated++;
};

const deleteTasksFromCsv = async (
  csvPath: string,
  dryRun: boolean,
  transaction?: Transaction
): Promise<MigrationCounts> => {
  const counts: MigrationCounts = { updated: 0, skipped: 0, errors: [] };
  const processedTaskIds = new Set<number>();

  await parseCsv(csvPath, async row => {
    const target = parseDeleteTaskRow(row);

    if (processedTaskIds.has(target.id)) {
      console.log(`Task id=${target.id}: duplicate CSV row — skipping`);
      counts.skipped++;
      return;
    }

    processedTaskIds.add(target.id);
    await deleteTask(target, dryRun, transaction, counts);
  });

  return counts;
};

/**
 * TM-3762: migrate reports to canonical reporting tasks and delete duplicate tasks.
 *
 * CSV files are not committed to git. Upload the five tm_3762_* CSV files to the wri-tm-repl S3 bucket
 * before running in AWS, or pass local filesystem paths in dev.
 *
 * Usage:
 * - dry run:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.migrateReportTasks({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.migrateReportTasks({ dryRun: false })"
 * - local dev with explicit paths:
 *   tm-v3-cli repl entity-service local --script "await oneOff.migrateReportTasks({ dryRun: true, projectReportsCsvPath: 'C:/Users/.../tm_3762_project_report_task_migration.csv', siteReportsCsvPath: '...', nurseryReportsCsvPath: '...', srpReportsCsvPath: '...' })"
 */
export const migrateReportTasks = withoutSqlLogs(async (opts: MigrateReportTasksOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const projectReportsCsvPath = assertNotNull(
    opts.projectReportsCsvPath ?? TM_3762_PROJECT_REPORTS_CSV_PATH,
    "projectReportsCsvPath is required"
  );
  const siteReportsCsvPath = assertNotNull(
    opts.siteReportsCsvPath ?? TM_3762_SITE_REPORTS_CSV_PATH,
    "siteReportsCsvPath is required"
  );
  const nurseryReportsCsvPath = assertNotNull(
    opts.nurseryReportsCsvPath ?? TM_3762_NURSERY_REPORTS_CSV_PATH,
    "nurseryReportsCsvPath is required"
  );
  const srpReportsCsvPath = assertNotNull(
    opts.srpReportsCsvPath ?? TM_3762_SRP_REPORTS_CSV_PATH,
    "srpReportsCsvPath is required"
  );
  const deleteTasksCsvPath = assertNotNull(
    opts.deleteTasksCsvPath ?? TM_3762_DELETE_TASKS_CSV_PATH,
    "deleteTasksCsvPath is required"
  );

  const [projectReports, siteReports, nurseryReports, srpReports] = await Promise.all([
    loadMigrationRows(projectReportsCsvPath),
    loadMigrationRows(siteReportsCsvPath),
    loadMigrationRows(nurseryReportsCsvPath),
    loadMigrationRows(srpReportsCsvPath)
  ]);

  console.log(`\nmigrate:report-tasks ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(
    `Rows: project=${projectReports.length}, site=${siteReports.length}, nursery=${nurseryReports.length}, srp=${srpReports.length}, deleteTasksCsv=${deleteTasksCsvPath}`
  );

  const sequelize = Task.sequelize;
  if (sequelize == null) {
    throw new Error("Task sequelize instance not available");
  }

  const run = async (transaction?: Transaction) => {
    const projectReportCounts = await migrateReports(
      "ProjectReport",
      ProjectReport,
      projectReports,
      dryRun,
      transaction
    );
    const siteReportCounts = await migrateReports("SiteReport", SiteReport, siteReports, dryRun, transaction);
    const nurseryReportCounts = await migrateReports(
      "NurseryReport",
      NurseryReport,
      nurseryReports,
      dryRun,
      transaction
    );
    const srpReportCounts = await migrateReports("SrpReport", SrpReport, srpReports, dryRun, transaction);
    const taskDeletionCounts = await deleteTasksFromCsv(deleteTasksCsvPath, dryRun, transaction);

    return {
      projectReports: projectReportCounts,
      siteReports: siteReportCounts,
      nurseryReports: nurseryReportCounts,
      srpReports: srpReportCounts,
      tasks: taskDeletionCounts
    };
  };

  const results = dryRun ? await run() : await sequelize.transaction(async transaction => run(transaction));

  console.log("\nResults:");
  for (const [table, counts] of Object.entries(results)) {
    console.log(`  ${table}: ${counts.updated} updated, ${counts.skipped} skipped`);
    if (counts.errors.length > 0) {
      console.log(`  Errors:\n    ${counts.errors.join("\n    ")}`);
    }
  }

  const totalErrors = Object.values(results).flatMap(({ errors }) => errors);
  if (totalErrors.length > 0) {
    throw new Error(`Migration aborted with ${totalErrors.length} validation error(s)`);
  }

  return results;
});
