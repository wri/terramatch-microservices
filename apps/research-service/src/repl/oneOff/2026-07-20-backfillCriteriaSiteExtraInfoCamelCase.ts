import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { CriteriaSite } from "@terramatch-microservices/database/entities";
import { CriteriaId } from "@terramatch-microservices/database/constants";
import { QueryTypes } from "sequelize";
import ProgressBar from "progress";
import { extraInfoNeedsBackfill, transformCriteriaSiteExtraInfo } from "./backfill-extra-info-camel-case.util";

export type BackfillCriteriaSiteExtraInfoOptions = {
  /** Resume after this criteria_site.id (exclusive). */
  afterId?: number;
  /** Rows fetched per batch. Default 1000. */
  batchSize?: number;
  /** When true, report counts without writing. */
  dryRun?: boolean;
};

export type BackfillCriteriaSiteExtraInfoSummary = {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  lastId: number | null;
  dryRun: boolean;
};

type CriteriaSiteExtraInfoRow = {
  id: number;
  criteriaId: CriteriaId;
  extraInfo: unknown;
};

type PendingUpdate = {
  id: number;
  extraInfoJson: string;
};

/**
 * One-off (REPL): rewrite legacy snake_case JSON in `criteria_site.extra_info` to the current
 * camelCase contract. Does not touch `criteria_site_historic`.
 *
 * Safe to re-run: only rows whose JSON still differs from the transformed shape are updated.
 * Writes are batched (one UPDATE CASE per page) for throughput.
 *
 */
export const backfillCriteriaSiteExtraInfoCamelCase = withoutSqlLogs(
  async (options: BackfillCriteriaSiteExtraInfoOptions = {}): Promise<BackfillCriteriaSiteExtraInfoSummary> => {
    const sequelize = CriteriaSite.sequelize;
    if (sequelize == null) {
      throw new Error("CriteriaSite sequelize instance not available");
    }

    const batchSize = options.batchSize ?? 1000;
    const dryRun = options.dryRun === true;
    let afterId = options.afterId ?? 0;

    const [{ total }] = (await sequelize.query(
      `
        SELECT COUNT(*) AS total
        FROM criteria_site
        WHERE extra_info IS NOT NULL
          AND JSON_TYPE(extra_info) != 'NULL'
          AND id > :afterId
      `,
      {
        replacements: { afterId },
        type: QueryTypes.SELECT
      }
    )) as Array<{ total: number | string }>;

    const totalRecords = Number(total);
    console.log(
      `backfillCriteriaSiteExtraInfoCamelCase: ${totalRecords} rows with extra_info after id=${afterId}` +
        (dryRun ? " (dryRun)" : "")
    );

    const bar = new ProgressBar("Backfilling criteria_site.extra_info [:bar] :current/:total :percent :etas", {
      width: 40,
      total: Math.max(totalRecords, 1)
    });

    const summary: BackfillCriteriaSiteExtraInfoSummary = {
      scanned: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      lastId: null,
      dryRun
    };

    const errorSamples: Array<{ id: number; error: string }> = [];

    while (true) {
      const rows = (await sequelize.query(
        `
          SELECT
            id,
            criteria_id AS criteriaId,
            extra_info AS extraInfo
          FROM criteria_site
          WHERE extra_info IS NOT NULL
            AND JSON_TYPE(extra_info) != 'NULL'
            AND id > :afterId
          ORDER BY id ASC
          LIMIT :batchSize
        `,
        {
          replacements: { afterId, batchSize },
          type: QueryTypes.SELECT
        }
      )) as CriteriaSiteExtraInfoRow[];

      if (rows.length === 0) {
        break;
      }

      const pendingUpdates: PendingUpdate[] = [];

      for (const row of rows) {
        summary.scanned += 1;
        summary.lastId = row.id;
        afterId = row.id;

        try {
          if (row.extraInfo == null) {
            summary.skipped += 1;
            continue;
          }

          const parsedExtraInfo =
            typeof row.extraInfo === "string" ? (JSON.parse(row.extraInfo) as unknown) : row.extraInfo;

          if (!extraInfoNeedsBackfill(parsedExtraInfo, row.criteriaId)) {
            summary.skipped += 1;
            continue;
          }

          const transformed = transformCriteriaSiteExtraInfo(parsedExtraInfo, row.criteriaId);
          pendingUpdates.push({
            id: row.id,
            extraInfoJson: JSON.stringify(transformed)
          });
        } catch (error) {
          summary.errors += 1;
          if (errorSamples.length < 20) {
            errorSamples.push({
              id: row.id,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
      }

      if (!dryRun && pendingUpdates.length > 0) {
        try {
          await flushPendingUpdates(sequelize, pendingUpdates);
          summary.updated += pendingUpdates.length;
        } catch {
          for (const update of pendingUpdates) {
            try {
              await sequelize.query(`UPDATE criteria_site SET extra_info = ? WHERE id = ?`, {
                replacements: [update.extraInfoJson, update.id],
                type: QueryTypes.UPDATE
              });
              summary.updated += 1;
            } catch (rowError) {
              summary.errors += 1;
              if (errorSamples.length < 20) {
                errorSamples.push({
                  id: update.id,
                  error: rowError instanceof Error ? rowError.message : "Unknown error"
                });
              }
            }
          }
        }
      } else if (dryRun) {
        summary.updated += pendingUpdates.length;
      }

      bar.tick(rows.length);
    }

    console.log("\n=== backfillCriteriaSiteExtraInfoCamelCase complete ===");
    console.table(summary);
    if (summary.lastId != null) {
      console.log(`Resume with: await oneOff.backfillCriteriaSiteExtraInfoCamelCase({ afterId: ${summary.lastId} })`);
    }
    if (errorSamples.length > 0) {
      console.log("Sample errors:");
      errorSamples.forEach(({ id, error }) => console.log(`  - id=${id}: ${error}`));
    }

    return summary;
  }
);

async function flushPendingUpdates(
  sequelize: NonNullable<typeof CriteriaSite.sequelize>,
  pendingUpdates: PendingUpdate[]
): Promise<void> {
  const caseFragments = pendingUpdates.map(() => "WHEN ? THEN ?").join(" ");
  const idPlaceholders = pendingUpdates.map(() => "?").join(", ");
  const replacements: Array<number | string> = [];

  for (const update of pendingUpdates) {
    replacements.push(update.id, update.extraInfoJson);
  }
  for (const update of pendingUpdates) {
    replacements.push(update.id);
  }

  await sequelize.query(
    `
      UPDATE criteria_site
      SET extra_info = CASE id
        ${caseFragments}
      END
      WHERE id IN (${idPlaceholders})
    `,
    {
      replacements,
      type: QueryTypes.UPDATE
    }
  );
}
