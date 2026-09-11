import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { assertNotNull } from "@terramatch-microservices/common/util/repl/assertions";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Investment, InvestmentSplit } from "@terramatch-microservices/database/entities";
import { CreationAttributes } from "sequelize";

type InvestmentRow = {
  uuid: string;
  projectId: number;
  investmentDate: Date;
  type: string;
};

type InvestmentSplitRow = {
  uuid: string;
  /** Matches a placeholder uuid from the investments CSV, or an existing Investment id. */
  investmentId: string;
  funder: string;
  amount: number;
};

type ImportInvestmentDataOptions = {
  dryRun?: boolean;
  /** In local dev: filesystem path. In AWS REPL: key in the wri-tm-repl S3 bucket. */
  investmentsCsvPath?: string;
  splitsCsvPath?: string;
};

const DEFAULT_INVESTMENTS_CSV = "tm_3893_investment_data.csv";
const DEFAULT_SPLITS_CSV = "tm_3893_investment_splits_data.csv";

const parseAmount = (raw: string): number => {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const amount = Number(cleaned);
  if (Number.isNaN(amount)) throw new Error(`Invalid amount: ${raw}`);
  return amount;
};

const loadInvestmentRows = async (csvPath: string): Promise<InvestmentRow[]> => {
  const rows: InvestmentRow[] = [];
  await parseCsv(csvPath, async row => {
    const projectIdRaw = assertNotNull(columnValue(row, "projectId"), "projectId is required");
    const projectId = Number(projectIdRaw);
    if (Number.isNaN(projectId)) throw new Error(`Invalid projectId: ${projectIdRaw}`);

    const dateRaw = assertNotNull(columnValue(row, "investmentDate"), "investmentDate is required");
    const investmentDate = new Date(dateRaw);
    if (isNaN(investmentDate.getTime())) throw new Error(`Invalid investmentDate: ${dateRaw}`);

    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      projectId,
      investmentDate,
      type: assertNotNull(columnValue(row, "type"), "type is required")
    });
  });
  return rows;
};

const loadSplitRows = async (csvPath: string): Promise<InvestmentSplitRow[]> => {
  const rows: InvestmentSplitRow[] = [];
  await parseCsv(csvPath, async row => {
    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      investmentId: assertNotNull(columnValue(row, "investmentId"), "investmentId is required"),
      funder: assertNotNull(columnValue(row, "funder"), "funder is required"),
      amount: parseAmount(assertNotNull(columnValue(row, "amount"), "amount is required"))
    });
  });
  return rows;
};

/**
 * Part 1 of TM-3893: Creates new Investment and InvestmentSplit records from CSV files.
 *
 * - investments CSV (tm_3893_investment_data.csv): uuid, projectId, investmentDate, type
 * - splits CSV (tm_3893_investment_splits_data.csv): uuid, investmentId, funder, amount
 *   The `investmentId` column matches either a placeholder uuid from the investments CSV (new record)
 *   or an existing Investment numeric id (for splits tied to existing investments).
 *
 * Usage (dry run by default):
 *   await oneOff.importInvestmentData()
 *   await oneOff.importInvestmentData({ dryRun: false })
 *   await oneOff.importInvestmentData({ dryRun: false, investmentsCsvPath: 'path/to/investments.csv', splitsCsvPath: 'path/to/splits.csv' })
 */
export const importInvestmentData = withoutSqlLogs(async (opts: ImportInvestmentDataOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const investmentsCsvPath = opts.investmentsCsvPath ?? DEFAULT_INVESTMENTS_CSV;
  const splitsCsvPath = opts.splitsCsvPath ?? DEFAULT_SPLITS_CSV;

  console.log(`\nimport:investment-data ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);

  const investmentRows = await loadInvestmentRows(investmentsCsvPath);
  const splitRows = await loadSplitRows(splitsCsvPath);

  console.log(`Investments to create: ${investmentRows.length}`);
  console.log(`Splits to create: ${splitRows.length}`);

  const counts = { investmentsCreated: 0, splitsCreated: 0, errors: [] as string[] };

  // Map from CSV placeholder uuid -> DB id for newly created investments
  const createdInvestmentIdByUuid = new Map<string, number>();
  const newInvestmentUuids = new Set(investmentRows.map(r => r.uuid));

  // --- Part 1a: Create Investment records ---
  for (const row of investmentRows) {
    console.log(
      `Investment (uuid=${row.uuid}): projectId=${row.projectId}, date=${row.investmentDate.toISOString()}, type=${row.type}`
    );

    if (!dryRun) {
      const investment = await Investment.create({
        projectId: row.projectId,
        investmentDate: row.investmentDate,
        type: row.type
      } as CreationAttributes<Investment>);
      createdInvestmentIdByUuid.set(row.uuid, investment.id);
      console.log(`  → created Investment id=${investment.id}`);
    }

    counts.investmentsCreated++;
  }

  // --- Part 1b: Create InvestmentSplit records ---
  for (const row of splitRows) {
    let investmentId: number | undefined;

    if (newInvestmentUuids.has(row.investmentId)) {
      // Linked to a newly created investment via CSV placeholder uuid
      investmentId = createdInvestmentIdByUuid.get(row.investmentId);
      if (investmentId == null && dryRun) {
        // Dry run: investment not created yet — use a placeholder for logging
        console.log(
          `InvestmentSplit (uuid=${row.uuid}): investmentId=<new:${row.investmentId}>, funder=${row.funder}, amount=${row.amount}`
        );
        counts.splitsCreated++;
        continue;
      }
    } else {
      // Existing investment referenced by numeric id
      const numericId = Number(row.investmentId);
      if (Number.isNaN(numericId)) {
        counts.errors.push(
          `InvestmentSplit (uuid=${row.uuid}): investmentId=${row.investmentId} is not a valid id or new-investment placeholder`
        );
        continue;
      }

      const existing = await Investment.findOne({
        where: { id: numericId },
        attributes: ["id", "uuid"]
      });

      if (existing == null) {
        counts.errors.push(`InvestmentSplit (uuid=${row.uuid}): investmentId=${row.investmentId} not found in DB`);
        continue;
      }

      investmentId = existing.id;
    }

    if (investmentId == null) {
      counts.errors.push(`InvestmentSplit (uuid=${row.uuid}): could not resolve investmentId=${row.investmentId}`);
      continue;
    }

    console.log(
      `InvestmentSplit (uuid=${row.uuid}): investmentId=${investmentId}, funder=${row.funder}, amount=${row.amount}`
    );

    if (!dryRun) {
      const split = await InvestmentSplit.create({
        investmentId,
        funder: row.funder,
        amount: row.amount
      } as CreationAttributes<InvestmentSplit>);
      console.log(`  → created InvestmentSplit id=${split.id}`);
    }

    counts.splitsCreated++;
  }

  console.log("\nResults:");
  console.log(`  investments created: ${counts.investmentsCreated}`);
  console.log(`  splits created: ${counts.splitsCreated}`);
  if (counts.errors.length > 0) {
    console.log(`  Errors:\n    ${counts.errors.join("\n    ")}`);
    throw new Error(`Import completed with ${counts.errors.length} error(s)`);
  }

  return counts;
});
