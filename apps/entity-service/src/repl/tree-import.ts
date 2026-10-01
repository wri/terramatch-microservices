import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { isEmpty } from "lodash";

const LOGGER = new TMLogger("Tree Import");

/**
 * This script is meant to be run in the REPL:
 * > await treeIMport('path-to-csv.csv');
 *
 * In local dev, the file path is expected to be in the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const treeImport = withoutSqlLogs(async (csvPath: string) => {
  let rowCount = 0;
  const warnings: string[] = [];
  try {
    await parseCsv(csvPath, async row => {
      rowCount++;

      const { uuid, name, taxon_id: taxonId } = row;
      if (isEmpty(uuid) || isEmpty(name) || isEmpty(taxonId)) {
        warnings.push(`Row ${rowCount} has invalid data [${JSON.stringify(row)}]`);
        return;
      }

      const tree = await TreeSpecies.findOne({ where: { uuid: row.uuid } });
      if (tree == null) {
        warnings.push(`Row ${rowCount} tree species UUID not found`);
        return;
      }

      await tree.update({ name, taxonId });
    });

    LOGGER.log(`Processed ${rowCount} rows from ${csvPath}`);

    if (warnings.length > 0) {
      LOGGER.warn("Warnings:");
      for (const warning of warnings) LOGGER.warn(warning);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : `${err}`;
    LOGGER.error(`Error processing CSV at ${csvPath} row ${rowCount + 1}: ${message}`);
  }
});
