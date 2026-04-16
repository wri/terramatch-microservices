import { FileService } from "@terramatch-microservices/common/file/file.service";
import { parseCsv } from "@terramatch-microservices/common/util/repl/parse-csv";
import { Investment, InvestmentSplit, Project } from "@terramatch-microservices/database/entities";
import { CreationAttributes } from "sequelize";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const LOGGER = new TMLogger("Investments Upload");

/**
 * This script is meant to run in the REPL:
 * > await uploadRecordsForInvestments(await resolve(FileService), 'path-to.csv'));
 *
 * In local dev, the file path is expected to be on the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const uploadRecordsForInvestments = withoutSqlLogs(
  async (fileService: FileService, csvPath1: string, csvPath2: string) => {
    let rowCount = 0;
    let rowCount2 = 0;
    try {
      await parseCsv(fileService, csvPath1, async row => {
        rowCount++;
        const investment = await Investment.create({
          projectId: Number(row.project_id),
          investmentDate: new Date(row.investment_date),
          type: row.type
        } as CreationAttributes<Investment>);
        LOGGER.log(`Investment created: ${investment.id} for project: ${row.project_id}`);

        await parseCsv(fileService, csvPath2, async row2 => {
          if (rowCount == Number(row2.uuid)) {
            rowCount2++;
            const investmentSplit = await InvestmentSplit.create({
              investmentId: investment.id,
              amount: Number(row2.amount),
              funder: row2.funder
            } as CreationAttributes<InvestmentSplit>);
            LOGGER.log(`Investment split created: ${investmentSplit.id} for investment: ${investment.id}`);
          }
        });
      });
      LOGGER.log(`Processed ${rowCount} rows from ${csvPath1}`);
      LOGGER.log(`Processed ${rowCount2} rows from ${csvPath2}`);
    } catch (err) {
      LOGGER.error(`Error processing CSV at ${csvPath1} row ${rowCount + 1}: ${err.message}`);
    }
  }
);
