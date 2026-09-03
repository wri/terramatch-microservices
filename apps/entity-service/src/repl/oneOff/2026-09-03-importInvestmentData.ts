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
  /** For new investments: matches the `uuid` column from the investments CSV to link them.
   *  For splits tied to an existing investment: use the existing investment's uuid directly. */
  investmentUuid: string;
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

const loadInvestmentRows = async (csvPath: string): Promise<InvestmentRow[]> => {
  const rows: InvestmentRow[] = [];
  await parseCsv(csvPath, async row => {
    const projectIdRaw = assertNotNull(columnValue(row, "project_id"), "project_id is required");
    const projectId = Number(projectIdRaw);
    if (Number.isNaN(projectId)) throw new Error(`Invalid project_id: ${projectIdRaw}`);

    const dateRaw = assertNotNull(columnValue(row, "investment_date"), "investment_date is required");
    const investmentDate = new Date(dateRaw);
    if (isNaN(investmentDate.getTime())) throw new Error(`Invalid investment_date: ${dateRaw}`);

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
    const amountRaw = assertNotNull(columnValue(row, "amount"), "amount is required");
    const amount = Number(amountRaw);
    if (Number.isNaN(amount)) throw new Error(`Invalid amount: ${amountRaw}`);

    rows.push({
      uuid: assertNotNull(columnValue(row, "uuid"), "uuid is required"),
      investmentUuid: assertNotNull(columnValue(row, "investment_uuid"), "investment_uuid is required"),
      funder: assertNotNull(columnValue(row, "funder"), "funder is required"),
      amount
    });
  });
  return rows;
};

/**
 * Part 1 of TM-3893: Creates new Investment and InvestmentSplit records from CSV files.
 *
 * - investments CSV (tm_3893_investment_data.csv): uuid, project_id, investment_date, type
 * - splits CSV (tm_3893_investment_splits_data.csv): uuid, investment_uuid, funder, amount
 *   The `investment_uuid` column must match either a uuid from the investments CSV (new record)
 *   or an existing Investment uuid in the DB (for splits tied to existing investments).
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

  // Map from CSV uuid -> DB id for newly created investments (used when linking splits)
  const createdInvestmentIdByUuid = new Map<string, number>();

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
    // Resolve investmentId: first check newly created, then look up existing in DB
    let investmentId: number | undefined = createdInvestmentIdByUuid.get(row.investmentUuid);

    if (investmentId == null) {
      const existing = await Investment.findOne({
        where: { uuid: row.investmentUuid },
        attributes: ["id", "uuid"]
      });

      if (existing == null) {
        counts.errors.push(
          `InvestmentSplit (uuid=${row.uuid}): investment_uuid=${row.investmentUuid} not found in DB or new investments CSV`
        );
        continue;
      }

      investmentId = existing.id;
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
