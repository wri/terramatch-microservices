import { CsvRowCallback, FileService } from "../../file/file.service";
import { Dictionary } from "lodash";
import { assert } from "./assertions";
import { getService } from "../bootstrap-repl";
import { CsvExportService, RowWriter } from "../../export/csv-export.service";
import fs from "fs";

const REPL_BUCKET = "wri-tm-repl";
const IS_AWS = process.env.NODE_ENV === "production";

/**
 * Parses the CSV at the given path. In local development, the path is expected to be on the local
 * filesystem. In AWS, the path should be a file in the wri-tm-repl S3 bucket.
 */
export const parseCsv = async (path: string, onRow: CsvRowCallback) => {
  const bucket = IS_AWS ? REPL_BUCKET : undefined;
  await getService(FileService).parseCsv(onRow, path, bucket);
};

export const writeCsv = async (fileName: string, columns: Dictionary<string>, writeRows: RowWriter) => {
  const service = getService(CsvExportService);
  const stream = IS_AWS
    ? service.getS3StreamWriter(fileName, columns, REPL_BUCKET)
    : service.getStreamWriter(fs.createWriteStream(fileName), columns);
  await service.writeToStream(stream, writeRows);
  if (IS_AWS) {
    return await getService(FileService).generatePresignedUrl(REPL_BUCKET, fileName);
  }
};

export const columnValue = (row: Dictionary<string>, columnName: string) => {
  assert(columnName in row, `Column ${columnName} not found.`);
  return row[columnName] === "" ? null : row[columnName];
};
