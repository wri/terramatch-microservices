import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assertNotNull, assertNumber } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Project, TreeSpecies } from "@terramatch-microservices/database/entities";

type ProjectImportRow = {
  uuid: string;
  shortName: string | null;
  survivalRate: number;
};

type TreeSpeciesImportRow = {
  uuid: string;
  amount: number;
};

type ImportOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  csvPath?: string;
};

const TM_3600_PROJECTS_CSV_PATH = "tm_3600_projects_import.csv";
const TM_3600_TREE_SPECIES_CSV_PATH = "tm_3600_tree_species_import.csv";

const loadProjectRows = async (csvPath: string): Promise<ProjectImportRow[]> => {
  const rows: ProjectImportRow[] = [];
  await parseCsv(csvPath, async row => {
    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      shortName: columnValue(row, "short_name"),
      survivalRate: assertNumber(columnValue(row, "survival_rate"), "survival_rate must be a number")
    });
  });

  return rows;
};

const loadTreeSpeciesRows = async (csvPath: string): Promise<TreeSpeciesImportRow[]> => {
  const rows: TreeSpeciesImportRow[] = [];
  await parseCsv(csvPath, async row => {
    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      amount: assertNumber(columnValue(row, "amount"), "amount must be a number")
    });
  });

  return rows;
};

/**
 * TM-3600: Updates survival_rate and short_name on v2_projects matched by uuid.
 *
 * CSV is not committed to git. Upload `tm_3600_projects_import.csv` to the wri-tm-repl S3 bucket
 * before running in AWS.
 *
 * Usage:
 * - dry run (local filesystem):
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importTerraFundProjects({ dryRun: true, csvPath: 'C:/path/to/tm_3600_projects_import.csv' })"
 * - execute from CSV in wri-tm-repl bucket:
 *   tm-v3-cli repl entity-service prod --script "await oneOff.importTerraFundProjects({ dryRun: false })"
 */
export const importTerraFundProjects = withoutSqlLogs(async (opts: ImportOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const csvPath = opts.csvPath ?? TM_3600_PROJECTS_CSV_PATH;

  const rows = await loadProjectRows(csvPath);

  console.log(`\nimport:terrafund-projects ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const project = await Project.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", "shortName", "survivalRate"]
    });

    if (project == null) {
      counts.errors.push(`Project uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    const alreadyApplied = project.shortName === row.shortName && project.survivalRate === row.survivalRate;

    if (alreadyApplied) {
      console.log(`Project ${project.id} (${row.uuid}): already has target short_name/survival_rate — skipping`);
      counts.skipped++;
      continue;
    }

    console.log(
      `Project ${project.id} (${row.uuid}): short_name ${project.shortName} -> ${row.shortName}, survival_rate ${project.survivalRate} -> ${row.survivalRate}`
    );

    if (!dryRun) {
      await project.update({
        shortName: row.shortName,
        survivalRate: row.survivalRate,
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

/**
 * TM-3600: Updates amount on v2_tree_species matched by uuid (trees to be planted).
 *
 * CSV is not committed to git. Upload `tm_3600_tree_species_import.csv` to the wri-tm-repl S3 bucket
 * before running in AWS.
 *
 * Usage:
 * - dry run (local filesystem):
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importTerraFundTreeSpecies({ dryRun: true, csvPath: 'C:/path/to/tm_3600_tree_species_import.csv' })"
 * - execute from CSV in wri-tm-repl bucket:
 *   tm-v3-cli repl entity-service prod --script "await oneOff.importTerraFundTreeSpecies({ dryRun: false })"
 */
export const importTerraFundTreeSpecies = withoutSqlLogs(async (opts: ImportOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const csvPath = opts.csvPath ?? TM_3600_TREE_SPECIES_CSV_PATH;

  const rows = await loadTreeSpeciesRows(csvPath);

  console.log(`\nimport:terrafund-tree-species ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const treeSpecies = await TreeSpecies.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", "amount"]
    });

    if (treeSpecies == null) {
      counts.errors.push(`TreeSpecies uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    const alreadyApplied = treeSpecies.amount === row.amount;

    if (alreadyApplied) {
      console.log(`TreeSpecies ${treeSpecies.id} (${row.uuid}): already has target amount — skipping`);
      counts.skipped++;
      continue;
    }

    console.log(`TreeSpecies ${treeSpecies.id} (${row.uuid}): amount ${treeSpecies.amount} -> ${row.amount}`);

    if (!dryRun) {
      await treeSpecies.update({ amount: row.amount });
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
