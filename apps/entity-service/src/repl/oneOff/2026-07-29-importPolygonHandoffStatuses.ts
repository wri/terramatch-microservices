import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assert, assertNotNull } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  POLYGON_DATA_SUBMISSION_VALUES,
  PolygonDataSubmission
} from "@terramatch-microservices/database/constants/polygon-data-submission";
import {
  PROJECT_QA_STATUS_VALUES,
  ProjectQaStatus
} from "@terramatch-microservices/database/constants/project-qa-status";
import { Project } from "@terramatch-microservices/database/entities";

type ImportOptions = {
  dryRun?: boolean;
  csvPath?: string;
};

type PolygonDataSubmissionRow = {
  uuid: string;
  polygonDataSubmission: PolygonDataSubmission;
};

type ProjectQaStatusRow = {
  uuid: string;
  projectQaStatus1: ProjectQaStatus | null;
  projectQaStatus2: ProjectQaStatus | null;
  projectQaStatus3: ProjectQaStatus | null;
  projectQaStatus4: ProjectQaStatus | null;
  projectQaStatus5: ProjectQaStatus | null;
};

const TM_POLYGON_DATA_SUBMISSION_CSV_PATH = "tm_polygon_data_submission_import.csv";
const TM_PROJECT_QA_STATUS_CSV_PATH = "tm_project_qa_status_import.csv";

const QA_CSV_COLUMNS = [
  "polygon_qa_status1",
  "polygon_qa_status2",
  "polygon_qa_status3",
  "polygon_qa_status4",
  "polygon_qa_status5"
] as const;

const QA_PROJECT_FIELDS = [
  "projectQaStatus1",
  "projectQaStatus2",
  "projectQaStatus3",
  "projectQaStatus4",
  "projectQaStatus5"
] as const;

const parsePolygonDataSubmission = (value: string | null, uuid: string): PolygonDataSubmission => {
  const parsed = assertNotNull(value, `uuid=${uuid}: polygonDataSubmission is required`);
  assert(
    (POLYGON_DATA_SUBMISSION_VALUES as readonly string[]).includes(parsed),
    `uuid=${uuid}: invalid polygonDataSubmission "${parsed}"`
  );
  return parsed as PolygonDataSubmission;
};

const parseProjectQaStatus = (value: string | null, uuid: string, column: string): ProjectQaStatus | null => {
  if (value == null) {
    return null;
  }

  assert((PROJECT_QA_STATUS_VALUES as readonly string[]).includes(value), `uuid=${uuid}: invalid ${column} "${value}"`);
  return value as ProjectQaStatus;
};

const loadPolygonDataSubmissionRows = async (csvPath: string): Promise<PolygonDataSubmissionRow[]> => {
  const rows: PolygonDataSubmissionRow[] = [];
  await parseCsv(csvPath, async row => {
    const uuid = assertNotNull(columnValue(row, "uuid"), "uuid is required");
    rows.push({
      uuid,
      polygonDataSubmission: parsePolygonDataSubmission(columnValue(row, "polygonDataSubmission"), uuid)
    });
  });
  return rows;
};

const loadProjectQaStatusRows = async (csvPath: string): Promise<ProjectQaStatusRow[]> => {
  const rows: ProjectQaStatusRow[] = [];
  await parseCsv(csvPath, async row => {
    const uuid = assertNotNull(columnValue(row, "uuid"), "uuid is required");
    rows.push({
      uuid,
      projectQaStatus1: parseProjectQaStatus(columnValue(row, QA_CSV_COLUMNS[0]), uuid, QA_CSV_COLUMNS[0]),
      projectQaStatus2: parseProjectQaStatus(columnValue(row, QA_CSV_COLUMNS[1]), uuid, QA_CSV_COLUMNS[1]),
      projectQaStatus3: parseProjectQaStatus(columnValue(row, QA_CSV_COLUMNS[2]), uuid, QA_CSV_COLUMNS[2]),
      projectQaStatus4: parseProjectQaStatus(columnValue(row, QA_CSV_COLUMNS[3]), uuid, QA_CSV_COLUMNS[3]),
      projectQaStatus5: parseProjectQaStatus(columnValue(row, QA_CSV_COLUMNS[4]), uuid, QA_CSV_COLUMNS[4])
    });
  });
  return rows;
};

export const importPolygonDataSubmission = withoutSqlLogs(async (opts: ImportOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const csvPath = opts.csvPath ?? TM_POLYGON_DATA_SUBMISSION_CSV_PATH;
  const rows = await loadPolygonDataSubmissionRows(csvPath);

  console.log(`\nimport:polygon-data-submission ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const project = await Project.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", "polygonDataSubmission"]
    });

    if (project == null) {
      counts.errors.push(`Project uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    if (project.polygonDataSubmission === row.polygonDataSubmission) {
      console.log(`Project ${project.id} (${row.uuid}): already has target polygonDataSubmission — skipping`);
      counts.skipped++;
      continue;
    }

    console.log(
      `Project ${project.id} (${row.uuid}): polygonDataSubmission ${project.polygonDataSubmission} -> ${row.polygonDataSubmission}`
    );

    if (!dryRun) {
      await project.update({
        polygonDataSubmission: row.polygonDataSubmission,
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

export const importProjectQaStatuses = withoutSqlLogs(async (opts: ImportOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const csvPath = opts.csvPath ?? TM_PROJECT_QA_STATUS_CSV_PATH;
  const rows = await loadProjectQaStatusRows(csvPath);

  console.log(`\nimport:project-qa-statuses ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const project = await Project.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", ...QA_PROJECT_FIELDS]
    });

    if (project == null) {
      counts.errors.push(`Project uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    const alreadyApplied = QA_PROJECT_FIELDS.every(field => project[field] === row[field]);
    if (alreadyApplied) {
      console.log(`Project ${project.id} (${row.uuid}): already has target projectQaStatus values — skipping`);
      counts.skipped++;
      continue;
    }

    const changes = QA_PROJECT_FIELDS.map(field => `${field}: ${project[field]} -> ${row[field]}`).join(", ");
    console.log(`Project ${project.id} (${row.uuid}): ${changes}`);

    if (!dryRun) {
      await project.update({
        projectQaStatus1: row.projectQaStatus1,
        projectQaStatus2: row.projectQaStatus2,
        projectQaStatus3: row.projectQaStatus3,
        projectQaStatus4: row.projectQaStatus4,
        projectQaStatus5: row.projectQaStatus5,
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
