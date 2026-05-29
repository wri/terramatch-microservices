import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Project } from "@terramatch-microservices/database/entities";
import { isEqual } from "lodash";

type ProjectCohortLandscapeRow = {
  uuid: string;
  cohort: string;
  landscape: string | null;
};

type ImportProjectCohortLandscapeOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  csvPath?: string;
};

const TM_3355_PROJECT_COHORT_LANDSCAPE_DATA: ProjectCohortLandscapeRow[] = [
  { uuid: "ebf3e80c-0dac-4aac-97cc-070fd6155966", cohort: "ppc", landscape: null },
  { uuid: "11547621-c474-4cbd-8ef9-846b7c6f5206", cohort: "ppc", landscape: null },
  { uuid: "854909b6-1bae-4424-82ce-797570e2779e", cohort: "ppc", landscape: null },
  { uuid: "cea58980-ed48-4b17-a534-9dc34ddb675c", cohort: "hbf", landscape: null },
  { uuid: "ca73dc04-c819-4bd8-957b-3874d7cfdcbc", cohort: "hbf", landscape: null },
  { uuid: "27b0c904-7f3d-4b92-8975-ae8082274a02", cohort: "hbf", landscape: null },
  { uuid: "411aa7a6-38ac-42ac-adf7-8e5aa22faae0", cohort: "hbf", landscape: null },
  { uuid: "f08b880f-c55e-41d0-8a10-498759aa9584", cohort: "hbf", landscape: null },
  {
    uuid: "cde946c3-5f1a-4782-9457-b399f284caf0",
    cohort: "terrafund-cohort-1",
    landscape: "Greater Rift Valley of Kenya"
  },
  {
    uuid: "a296d246-7545-4c8d-8781-49876ec03ba9",
    cohort: "terrafund-cohort-2",
    landscape: "Greater Rift Valley of Kenya"
  },
  {
    uuid: "c9534124-afcb-4c06-bfdb-d2ade7b82b54",
    cohort: "terrafund-cohort-1",
    landscape: "Lake Kivu & Rusizi River Basin"
  },
  {
    uuid: "a47c6c63-0558-49ca-9dfa-c26ce39981bf",
    cohort: "terrafund-cohort-2",
    landscape: "Lake Kivu & Rusizi River Basin"
  },
  {
    uuid: "71ffc45f-584a-472c-808d-7715c8d94929",
    cohort: "terrafund-cohort-1",
    landscape: "Greater Rift Valley of Kenya"
  },
  {
    uuid: "b19c9cb1-8cb3-41f8-8aa7-5104e2ae9897",
    cohort: "terrafund-cohort-2",
    landscape: "Greater Rift Valley of Kenya"
  },
  {
    uuid: "0f8df0f7-404c-4b7d-a3cc-c7100c869890",
    cohort: "terrafund-cohort-2",
    landscape: "Greater Rift Valley of Kenya"
  },
  {
    uuid: "e4a9f60c-e555-43ff-b428-5b13f6501d66",
    cohort: "terrafund-cohort-1",
    landscape: "Greater Rift Valley of Kenya"
  },
  {
    uuid: "385e647c-0b37-42e2-a7ee-b8c8fb454de1",
    cohort: "terrafund-cohort-2",
    landscape: "Greater Rift Valley of Kenya"
  }
];

const loadRows = async (csvPath?: string): Promise<ProjectCohortLandscapeRow[]> => {
  if (csvPath == null) {
    return TM_3355_PROJECT_COHORT_LANDSCAPE_DATA;
  }

  const rows: ProjectCohortLandscapeRow[] = [];
  await parseCsv(csvPath, async row => {
    rows.push({
      uuid: columnValue(row, "uuid") as string,
      cohort: columnValue(row, "cohort") as string,
      landscape: columnValue(row, "landscape")
    });
  });

  return rows;
};

/**
 * Imports cohort and landscape values for v2_projects from TM-3355.
 *
 * Usage:
 * - dry run (embedded data):
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importProjectCohortLandscape({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importProjectCohortLandscape({ dryRun: false })"
 * - execute from CSV in wri-tm-repl bucket:
 *   tm-v3-cli repl entity-service prod --script "await oneOff.importProjectCohortLandscape({ dryRun: false, csvPath: 'tm_3355_project_cohort_landscape_data.csv' })"
 */
export const importProjectCohortLandscape = withoutSqlLogs(async (opts: ImportProjectCohortLandscapeOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const rows = await loadRows(opts.csvPath);

  console.log(`\nimport:project-cohort-landscape ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const project = await Project.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", "cohort", "landscape"]
    });

    if (project == null) {
      counts.errors.push(`Project uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    const nextCohort = row.cohort;
    const nextLandscape = row.landscape;
    const alreadyApplied = isEqual(project.cohort, nextCohort) && project.landscape === nextLandscape;

    if (alreadyApplied) {
      console.log(`Project ${project.id} (${row.uuid}): already has target cohort/landscape — skipping`);
      counts.skipped++;
      continue;
    }

    console.log(
      `Project ${project.id} (${row.uuid}): cohort ${project.cohort} -> ${nextCohort}, landscape ${project.landscape} -> ${nextLandscape}`
    );

    if (!dryRun) {
      await project.update({
        cohort: nextCohort,
        landscape: nextLandscape,
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
