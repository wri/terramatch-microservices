import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { QueryTypes, Transaction } from "sequelize";
import { Task } from "@terramatch-microservices/database/entities";

type StatusColumn = "status" | "update_request_status";

type TableStatusUpdate = {
  table: string;
  column: StatusColumn;
  from: string;
  to: string;
};

/**
 * Aligns persisted status slugs with TM-3789 design copy.
 *
 * Tables / columns updated:
 * 1) Entity / report / task / form / organisation status columns
 * 2) audit_statuses.status          — column slug rename
 * 3) audit_statuses.comment         — "Awaiting Review:" → "Pending Approval:"
 * 4) audits.old_values / new_values — embedded JSON status slug rename via string REPLACE
 *      e.g. {"status":"started"} → {"status":"draft"}
 *           {"status":"awaiting-approval"} → {"status":"pending-approval"}
 *           {"status":"needs-more-information"} → {"status":"information-required"}
 *           {"status":"requires-more-information"} → {"status":"information-required"}
 * 5) NULL update_request_status     → "no-update" (all entity/report tables with the column)
 * 6) NULL organisations.status      → "draft"
 *
 * Run in entity-service REPL (restart REPL first so this file is reloaded):
 *   await oneOff.renameEntityStatusSlugs()
 *
 * Safe to re-run. Includes soft-deleted audit_statuses rows (raw SQL, no deleted_at filter).
 */
const STATUS_RENAMES: Array<{ from: string; to: string }> = [
  { from: "awaiting-approval", to: "pending-approval" },
  { from: "needs-more-information", to: "information-required" },
  { from: "requires-more-information", to: "information-required" },
  { from: "started", to: "draft" }
];

/** Extra renames only applied inside audits JSON (org status history). */
const AUDIT_JSON_STATUS_RENAMES: Array<{ from: string; to: string }> = [
  ...STATUS_RENAMES,
  { from: "pending", to: "pending-approval" }
];

const STATUS_ONLY_TABLES = ["v2_tasks", "form_submissions", "audit_statuses", "v2_update_requests"];

const STATUS_AND_UPDATE_REQUEST_TABLES = [
  "v2_site_reports",
  "v2_project_reports",
  "v2_nursery_reports",
  "srp_reports",
  "financial_reports",
  "disturbance_reports",
  "v2_projects",
  "v2_sites",
  "v2_nurseries"
];

const AUDIT_JSON_COLUMNS = ["old_values", "new_values"] as const;

const buildUpdates = (): TableStatusUpdate[] => {
  const updates: TableStatusUpdate[] = [];

  for (const table of STATUS_ONLY_TABLES) {
    for (const { from, to } of STATUS_RENAMES) {
      updates.push({ table, column: "status", from, to });
    }
  }

  for (const table of STATUS_AND_UPDATE_REQUEST_TABLES) {
    for (const { from, to } of STATUS_RENAMES) {
      updates.push({ table, column: "status", from, to });
      updates.push({ table, column: "update_request_status", from, to });
    }
  }

  updates.push({ table: "organisations", column: "status", from: "pending", to: "pending-approval" });

  return updates;
};

const affectedRows = (metadata: unknown): number =>
  typeof metadata === "object" && metadata != null && "affectedRows" in metadata
    ? Number((metadata as { affectedRows: number }).affectedRows)
    : 0;

/**
 * Table: audits
 * Columns: old_values, new_values (MariaDB LONGTEXT / TEXT storing JSON — OwenIt format)
 *
 * MariaDB does not support CAST(... AS JSON). Use string REPLACE on the JSON text instead.
 *
 * Example rows from prod:
 *   {"status":"awaiting-approval"}
 *   {"status":"started"}
 *   {"status":"needs-more-information"}
 *   {"feedback":"...","status":"requires-more-information"}
 */
const renameAuditsTableJsonStatuses = async (
  sequelize: NonNullable<typeof Task.sequelize>,
  transaction: Transaction,
  counts: Record<string, number>
) => {
  for (const column of AUDIT_JSON_COLUMNS) {
    for (const { from, to } of AUDIT_JSON_STATUS_RENAMES) {
      // Match both compact and spaced JSON encodings produced historically.
      const patterns: Array<{ fromToken: string; toToken: string }> = [
        { fromToken: `"status":"${from}"`, toToken: `"status":"${to}"` },
        { fromToken: `"status": "${from}"`, toToken: `"status": "${to}"` }
      ];

      let total = 0;
      for (const { fromToken, toToken } of patterns) {
        const [, metadata] = await sequelize.query(
          `UPDATE \`audits\`
           SET \`${column}\` = REPLACE(\`${column}\`, :fromToken, :toToken)
           WHERE \`${column}\` LIKE :likePattern`,
          {
            replacements: {
              fromToken,
              toToken,
              likePattern: `%${fromToken}%`
            },
            type: QueryTypes.UPDATE,
            transaction
          }
        );
        total += affectedRows(metadata);
      }
      counts[`audits.${column}:${from}->${to}`] = total;
    }
  }
};

/**
 * Table: audit_statuses
 * - status column: handled in buildUpdates
 * - comment: rewrite historical "Awaiting Review:" prefix
 */
const renameAuditStatusesTableComments = async (
  sequelize: NonNullable<typeof Task.sequelize>,
  transaction: Transaction,
  counts: Record<string, number>
) => {
  const [, metadata] = await sequelize.query(
    `UPDATE \`audit_statuses\`
     SET \`comment\` = REPLACE(\`comment\`, 'Awaiting Review:', 'Pending Approval:')
     WHERE \`comment\` LIKE '%Awaiting Review:%'`,
    {
      type: QueryTypes.UPDATE,
      transaction
    }
  );
  counts["audit_statuses.comment:Awaiting Review:->Pending Approval:"] = affectedRows(metadata);
};

/**
 * Null cleanup that is not a simple slug rename:
 * - update_request_status NULL → no-update
 * - organisations.status NULL → draft
 */
const normalizeNullStatuses = async (
  sequelize: NonNullable<typeof Task.sequelize>,
  transaction: Transaction,
  counts: Record<string, number>
) => {
  for (const table of STATUS_AND_UPDATE_REQUEST_TABLES) {
    const [, nullMeta] = await sequelize.query(
      `UPDATE \`${table}\` SET \`update_request_status\` = 'no-update' WHERE \`update_request_status\` IS NULL`,
      { type: QueryTypes.UPDATE, transaction }
    );
    counts[`${table}.update_request_status:NULL->no-update`] = affectedRows(nullMeta);
  }

  const [, orgNullMeta] = await sequelize.query(
    `UPDATE \`organisations\` SET \`status\` = 'draft' WHERE \`status\` IS NULL`,
    { type: QueryTypes.UPDATE, transaction }
  );
  counts["organisations.status:NULL->draft"] = affectedRows(orgNullMeta);
};

export const renameEntityStatusSlugs = withoutSqlLogs(async (): Promise<Record<string, number>> => {
  const sequelize = Task.sequelize;
  if (sequelize == null) throw new Error("Sequelize instance not available");

  const summary = await sequelize.transaction(async (transaction: Transaction) => {
    const counts: Record<string, number> = {};

    for (const { table, column, from, to } of buildUpdates()) {
      const key = `${table}.${column}:${from}->${to}`;
      const [, metadata] = await sequelize.query(
        `UPDATE \`${table}\` SET \`${column}\` = :to WHERE \`${column}\` = :from`,
        {
          replacements: { from, to },
          type: QueryTypes.UPDATE,
          transaction
        }
      );
      counts[key] = affectedRows(metadata);
    }

    await renameAuditsTableJsonStatuses(sequelize, transaction, counts);
    await renameAuditStatusesTableComments(sequelize, transaction, counts);
    await normalizeNullStatuses(sequelize, transaction, counts);

    return counts;
  });

  console.log("renameEntityStatusSlugs complete");
  console.log("  - entity/report/task/form/org status columns");
  console.log("  - audit_statuses.status + audit_statuses.comment");
  console.log("  - audits.old_values + audits.new_values (REPLACE on JSON text)");
  console.log("  - NULL update_request_status → no-update");
  console.log("  - NULL organisations.status → draft");
  console.table(summary);
  return summary;
});
