import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assertNotNull } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Project } from "@terramatch-microservices/database/entities";

type ProjectSummaryRow = {
  uuid: string;
  projectSummary: string | null;
};

type ImportProjectSummaryOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  csvPath?: string;
};

const TM_3454_CSV_PATH = "tm_3454_import.csv";

const loadRows = async (csvPath: string): Promise<ProjectSummaryRow[]> => {
  const rows: ProjectSummaryRow[] = [];
  await parseCsv(csvPath, async row => {
    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      projectSummary: columnValue(row, "projectSummary")
    });
  });

  return rows;
};

/**
 * Imports project_summary values for v2_projects from TM-3454.
 *
 * CSV is not committed to git (~535 rows). Upload `tm_3454_import.csv` to the wri-tm-repl S3 bucket
 * before running in AWS (same pattern as TM-3355 cohort/landscape import).
 *
 * Usage:
 * - dry run (local filesystem):
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importProjectSummary({ dryRun: true, csvPath: 'C:/path/to/tm_3454_import.csv' })"
 * - dry run (S3 default key):
 *   tm-v3-cli repl entity-service prod --script "await oneOff.importProjectSummary({ dryRun: true })"
 * - execute from CSV in wri-tm-repl bucket:
 *   tm-v3-cli repl entity-service prod --script "await oneOff.importProjectSummary({ dryRun: false })"
 */
export const importProjectSummary = withoutSqlLogs(async (opts: ImportProjectSummaryOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const csvPath = opts.csvPath ?? TM_3454_CSV_PATH;

  const rows = await loadRows(csvPath);

  console.log(`\nimport:project-summary ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const project = await Project.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", "projectSummary"]
    });

    if (project == null) {
      counts.errors.push(`Project uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    const nextProjectSummary = row.projectSummary;
    const alreadyApplied = project.projectSummary === nextProjectSummary;

    if (alreadyApplied) {
      console.log(`Project ${project.id} (${row.uuid}): already has target project_summary — skipping`);
      counts.skipped++;
      continue;
    }

    console.log(`Project ${project.id} (${row.uuid}): updating project_summary`);

    if (!dryRun) {
      await project.update({
        projectSummary: nextProjectSummary,
        updatedAt: new Date()
      });
    }

    counts.updated++;
  }

  console.log("\nResults:");
  console.log(`  updated: ${counts.updated}, skipped: ${counts.skipped}`);
  if (counts.errors.length > 0) {
    console.log(`  Errors:\n    ${counts.errors.join("\n    ")}`);
  }

  if (counts.errors.length > 0) {
    throw new Error(`Import aborted with ${counts.errors.length} validation error(s)`);
  }

  return counts;
});
