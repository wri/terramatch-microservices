import { CsvRowCallback, FileService } from "../../file/file.service";
import { Dictionary } from "lodash";
import { assert } from "./assertions";
import { getService } from "../bootstrap-repl";

const REPL_BUCKET = "wri-tm-repl";

/**
 * Parses the CSV at the given. In local development, the path is expected to be on the local
 * filesystem. In AWS, the path should be a file in the wri-tm-repl S3 bucket.
 */
export const parseCsv = async (path: string, onRow: CsvRowCallback) => {
  const bucket = process.env.NODE_ENV === "production" ? REPL_BUCKET : undefined;
  await getService(FileService).parseCsv(onRow, path, bucket);
};

// export const writeCsv = async (csvExportService: FileService, fileName: string, )

export const columnValue = (row: Dictionary<string>, columnName: string) => {
  assert(columnName in row, `Column ${columnName} not found.`);
  return row[columnName] === "" ? null : row[columnName];
};
