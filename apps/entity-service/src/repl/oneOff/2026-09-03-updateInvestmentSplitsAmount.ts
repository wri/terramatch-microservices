import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assertNotNull } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { InvestmentSplit } from "@terramatch-microservices/database/entities";

type InvestmentSplitUpdateRow = {
  uuid: string;
  amount: number;
};

type UpdateInvestmentSplitsAmountOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  csvPath?: string;
};

const DEFAULT_CSV = "Part two_tm_3893.csv";

const loadRows = async (csvPath: string): Promise<InvestmentSplitUpdateRow[]> => {
  const rows: InvestmentSplitUpdateRow[] = [];
  await parseCsv(csvPath, async row => {
    const amountRaw = assertNotNull(columnValue(row, "amount"), "amount is required");
    const amount = Number(amountRaw);
    if (Number.isNaN(amount)) throw new Error(`Invalid amount: ${amountRaw}`);

    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      amount
    });
  });
  return rows;
};

/**
 * Part 2 of TM-3893: Updates the `amount` field on existing InvestmentSplit records,
 * matching by `investment_splits.uuid`.
 *
 * CSV format (Part two_tm_3893.csv): uuid, amount
 *
 * Usage (dry run by default):
 *   await oneOff.updateInvestmentSplitsAmount()
 *   await oneOff.updateInvestmentSplitsAmount({ dryRun: false })
 *   await oneOff.updateInvestmentSplitsAmount({ dryRun: false, csvPath: 'path/to/Part two_tm_3893.csv' })
 */
export const updateInvestmentSplitsAmount = withoutSqlLogs(async (opts: UpdateInvestmentSplitsAmountOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const csvPath = opts.csvPath ?? DEFAULT_CSV;

  const rows = await loadRows(csvPath);

  console.log(`\nupdate:investment-splits-amount ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const investmentSplit = await InvestmentSplit.findOne({
      where: { uuid: row.uuid },
      attributes: ["id", "uuid", "amount"]
    });

    if (investmentSplit == null) {
      counts.errors.push(`InvestmentSplit uuid=${row.uuid}: record not found`);
      counts.skipped++;
      continue;
    }

    const nextAmount = row.amount;
    const alreadyApplied = Number(investmentSplit.amount) === nextAmount;

    if (alreadyApplied) {
      console.log(
        `InvestmentSplit ${investmentSplit.id} (${row.uuid}): already has target amount ${nextAmount} — skipping`
      );
      counts.skipped++;
      continue;
    }

    console.log(
      `InvestmentSplit ${investmentSplit.id} (${row.uuid}): updating amount ${investmentSplit.amount} -> ${nextAmount}`
    );

    if (!dryRun) {
      await investmentSplit.update({
        amount: nextAmount,
        updatedAt: new Date()
      });
    }

    counts.updated++;
  }

  console.log("\nResults:");
  console.log(`  updated: ${counts.updated}, skipped: ${counts.skipped}`);
  if (counts.errors.length > 0) {
    console.log(`  Errors:\n    ${counts.errors.join("\n    ")}`);
    throw new Error(`Import completed with ${counts.errors.length} error(s)`);
  }

  return counts;
});
