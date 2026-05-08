import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Media, ProjectReport } from "@terramatch-microservices/database/entities";
import { chunk } from "lodash";
import { Op, QueryTypes } from "sequelize";

type DedupeProjectReportDocumentsOptions = {
  dryRun?: boolean;
  /** Defaults to ppc. Pass another framework key to widen scope. */
  frameworkKey?: string;
  projectUuid?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
  batchSize?: number;
};

type DuplicateDiagnosticRow = {
  reportId: number;
  reportUuid: string;
  projectUuid: string;
  collectionNames: string;
  dedupeKey: string;
  totalRows: number;
  mediaIds: string;
};

type DuplicateGroup = {
  reportId: number;
  reportUuid: string;
  projectUuid: string;
  collectionNames: string;
  dedupeKey: string;
  totalRows: number;
  keepId: number;
  removeIds: number[];
};

function buildDiagnosticSql(filters: {
  frameworkKey: string;
  modelType: string;
  projectUuid?: string;
  fromDate?: Date;
  toDate?: Date;
}): string {
  const where: string[] = [
    "m.model_type = :modelType",
    "m.deleted_at IS NULL",
    "pr.deleted_at IS NULL",
    "COALESCE(pr.framework_key, p.framework_key) = :frameworkKey"
  ];

  if (filters.projectUuid != null) {
    where.push("p.uuid = :projectUuid");
  }
  if (filters.fromDate != null) {
    where.push("m.created_at >= :fromDate");
  }
  if (filters.toDate != null) {
    where.push("m.created_at <= :toDate");
  }

  return `
    SELECT
      m.model_id AS reportId,
      pr.uuid AS reportUuid,
      p.uuid AS projectUuid,
      GROUP_CONCAT(DISTINCT m.collection_name ORDER BY m.collection_name SEPARATOR ',') AS collectionNames,
      CONCAT(m.file_name, '::', m.size) AS dedupeKey,
      COUNT(*) AS totalRows,
      GROUP_CONCAT(m.id ORDER BY m.id ASC) AS mediaIds
    FROM media m
    INNER JOIN v2_project_reports pr ON pr.id = m.model_id
    INNER JOIN v2_projects p ON p.id = pr.project_id
    WHERE ${where.join(" AND ")}
    GROUP BY m.model_id, pr.uuid, p.uuid, m.file_name, m.size
    HAVING COUNT(*) > 1
    ORDER BY totalRows DESC, m.model_id ASC, m.file_name ASC;
  `;
}

function duplicateGroupsFromRows(rows: DuplicateDiagnosticRow[]): DuplicateGroup[] {
  return rows
    .map(row => {
      const ids = row.mediaIds
        .split(",")
        .map(raw => Number.parseInt(raw.trim(), 10))
        .filter(id => Number.isFinite(id))
        .sort((a, b) => a - b);

      if (ids.length < 2) return null;
      return {
        reportId: row.reportId,
        reportUuid: row.reportUuid,
        projectUuid: row.projectUuid,
        collectionNames: row.collectionNames,
        dedupeKey: row.dedupeKey,
        totalRows: row.totalRows,
        keepId: ids[0],
        removeIds: ids.slice(1)
      };
    })
    .filter((group): group is DuplicateGroup => group != null && group.removeIds.length > 0);
}

const parseDate = (value?: string | Date): Date | undefined => {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
};

/**
 * Deduplicates duplicate media rows attached to project reports.
 *
 * Duplicate rule: same report + same file_name + same size (any collection_name).
 * Keeps the lowest media id per group; removes extras (e.g. copy in both `media` and `file`).
 *
 * Effective framework filter: COALESCE(pr.framework_key, p.framework_key) = frameworkKey
 * (default ppc), so reports with NULL framework_key still match PPC projects.
 *
 * Usage:
 * - dry run:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.dedupeProjectReportDocuments({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.dedupeProjectReportDocuments({ dryRun: false })"
 */
export const dedupeProjectReportDocuments = withoutSqlLogs(async (opts: DedupeProjectReportDocumentsOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const frameworkKey = opts.frameworkKey ?? "ppc";
  const batchSize = opts.batchSize ?? 250;
  const fromDate = parseDate(opts.fromDate);
  const toDate = parseDate(opts.toDate);

  const sql = buildDiagnosticSql({
    frameworkKey,
    modelType: ProjectReport.LARAVEL_TYPE,
    projectUuid: opts.projectUuid,
    fromDate,
    toDate
  });

  console.log(`\ndedupe:project-report-documents ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log("Diagnostic SQL:");
  console.log(sql);

  const sequelize = Media.sequelize;
  if (sequelize == null) {
    throw new Error("Media sequelize instance not available");
  }

  const rows = await sequelize.query<DuplicateDiagnosticRow>(sql, {
    type: QueryTypes.SELECT,
    replacements: {
      frameworkKey,
      modelType: ProjectReport.LARAVEL_TYPE,
      projectUuid: opts.projectUuid,
      fromDate,
      toDate
    }
  });

  const groups = duplicateGroupsFromRows(rows);
  const deleteIds = groups.flatMap(group => group.removeIds);
  const uniqueDeleteIds = Array.from(new Set(deleteIds));

  const summary = {
    frameworkKey,
    projectUuid: opts.projectUuid ?? null,
    duplicateGroups: groups.length,
    rowsToSoftDelete: uniqueDeleteIds.length
  };

  console.table(summary);
  if (groups.length > 0) {
    console.table(
      groups.slice(0, 20).map(group => ({
        reportUuid: group.reportUuid,
        projectUuid: group.projectUuid,
        collectionNames: group.collectionNames,
        dedupeKey: group.dedupeKey,
        totalRows: group.totalRows,
        keepId: group.keepId,
        removeCount: group.removeIds.length
      }))
    );
  }

  if (dryRun || uniqueDeleteIds.length === 0) return;

  let deleted = 0;
  for (const idChunk of chunk(uniqueDeleteIds, batchSize)) {
    deleted += await Media.destroy({
      where: {
        id: { [Op.in]: idChunk },
        modelType: ProjectReport.LARAVEL_TYPE,
        deletedAt: null
      }
    });
  }

  console.log(`Soft-deleted duplicate media rows: ${deleted}`);
});
