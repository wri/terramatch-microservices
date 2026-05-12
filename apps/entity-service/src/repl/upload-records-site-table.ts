import { parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { Site } from "@terramatch-microservices/database/entities";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const LOGGER = new TMLogger("Investments Upload");

/**
 * This script is meant to run in the REPL:
 * > await uploadRecordsForSites('path-to-1.csv');
 *
 * In local dev, the file path is expected to be on the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const uploadRecordsForSites = withoutSqlLogs(async (csvPath: string) => {
  let rowCount = 0;
  try {
    await parseCsv(csvPath, async row => {
      rowCount++;
      const site = await Site.findOne({ where: { uuid: row.siteUuid } });
      if (site) {
        await site.update({
          startDate: new Date(row.startDate),

          restorationStrategy: JSON.parse(row.restorationStrategy),
          landUseTypes: JSON.parse(row.landUseTypes)
        });
      }
    });
    LOGGER.log(`Processed ${rowCount} rows from ${csvPath}`);
  } catch (err) {
    LOGGER.error(`Error processing CSV at ${csvPath} row ${rowCount + 1}: ${err.message}`);
  }
});
