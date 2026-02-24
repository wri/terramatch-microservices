import { FileService } from "@terramatch-microservices/common/file/file.service";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/without-sql-logs";
import { parseCsv } from "@terramatch-microservices/common/util/repl/parse-csv";

/**
 * This script is meant to run in the REPL:
 * > await bulkWorkdayImport(await resolve(FileService), 'path-to.csv'));
 *
 * In local dev, the file path is expected to be on the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const bulkWorkdayImport = withoutSqlLogs(async (fileService: FileService, csvPath: string) => {
  try {
    let rowCount = 0;
    await parseCsv(fileService, csvPath, row => {
      rowCount++;
      console.log("Processing row", row);
    });

    console.log(`Processed ${rowCount} rows from ${csvPath}`);
  } catch (err) {
    console.error(`Error processing CSV at ${csvPath}: ${err.message}`);
  }
});
