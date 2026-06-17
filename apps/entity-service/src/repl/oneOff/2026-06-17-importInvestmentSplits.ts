import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assertNotNull } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { InvestmentSplit } from "@terramatch-microservices/database/entities";

type InvestmentSplitRow = {
  id: number;
  uuid: string;
  amount: number;
};

type ImportInvestmentSplitsOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  csvPath?: string;
};

const TM_3528_INVESTMENT_SPLITS_DATA: InvestmentSplitRow[] = [
  { id: 238, uuid: "1da83998-713e-46f1-a1db-4809a6a11255", amount: 279559.36 },
  { id: 259, uuid: "3a193a5c-0d48-4828-a99a-ecca2514cb8d", amount: 260000 },
  { id: 293, uuid: "a6c13582-1d2a-4479-b779-7730c1eddaa1", amount: 210000 },
  { id: 283, uuid: "e5b5086e-f31e-4f5b-839b-2f5990c1c982", amount: 310000 },
  { id: 241, uuid: "ee1950bf-02c3-409e-bd7e-97521b933453", amount: 73954.13 },
  { id: 264, uuid: "f7dcd86a-05ce-424a-b02b-6d46ef90298b", amount: 150000 }
];

const loadRows = async (csvPath?: string): Promise<InvestmentSplitRow[]> => {
  if (csvPath == null) {
    return TM_3528_INVESTMENT_SPLITS_DATA;
  }

  const rows: InvestmentSplitRow[] = [];
  await parseCsv(csvPath, async row => {
    const amountRaw = assertNotNull(columnValue(row, "amount"), "amount is required");
    const amount = Number(amountRaw);
    if (Number.isNaN(amount)) {
      throw new Error(`Invalid amount value: ${amountRaw}`);
    }

    rows.push({
      id: Number(assertNotNull(columnValue(row, "id"), "id is required")),
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      amount
    });
  });

  return rows;
};

/**
 * Imports amount values for investment_splits from TM-3528.
 *
 * Records are matched by id. Only amount is updated; uuid differences are logged but not treated as errors.
 *
 * Embedded data (id, uuid, amount):
 * - 238, 1da83998-713e-46f1-a1db-4809a6a11255, 279559.36
 * - 259, 3a193a5c-0d48-4828-a99a-ecca2514cb8d, 260000
 * - 293, a6c13582-1d2a-4479-b779-7730c1eddaa1, 210000
 * - 283, e5b5086e-f31e-4f5b-839b-2f5990c1c982, 310000
 * - 241, ee1950bf-02c3-409e-bd7e-97521b933453, 73954.13
 * - 264, f7dcd86a-05ce-424a-b02b-6d46ef90298b, 150000
 *
 * Usage:
 * - dry run (embedded data):
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importInvestmentSplits({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.importInvestmentSplits({ dryRun: false })"
 */
export const importInvestmentSplits = withoutSqlLogs(async (opts: ImportInvestmentSplitsOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const rows = await loadRows(opts.csvPath);

  console.log(`\nimport:investment-splits ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Rows to process: ${rows.length}`);

  const counts = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const investmentSplit = await InvestmentSplit.findOne({
      where: { id: row.id },
      attributes: ["id", "uuid", "amount"]
    });

    if (investmentSplit == null) {
      counts.errors.push(`InvestmentSplit id=${row.id}: record not found`);
      counts.skipped++;
      continue;
    }

    const nextAmount = row.amount;
    const amountMatches = Number(investmentSplit.amount) === nextAmount;

    if (investmentSplit.uuid !== row.uuid) {
      console.log(
        `InvestmentSplit ${investmentSplit.id}: uuid differs (db=${investmentSplit.uuid}, import=${row.uuid}) — updating amount only`
      );
    }

    if (amountMatches) {
      console.log(`InvestmentSplit ${investmentSplit.id}: already has target amount — skipping`);
      counts.skipped++;
      continue;
    }

    console.log(`InvestmentSplit ${investmentSplit.id}: updating amount ${investmentSplit.amount} -> ${nextAmount}`);

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
  }

  if (counts.errors.length > 0) {
    throw new Error(`Import aborted with ${counts.errors.length} validation error(s)`);
  }

  return counts;
});
