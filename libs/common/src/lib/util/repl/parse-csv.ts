import { CsvRowCallback, FileService } from "../../file/file.service";

const REPL_BUCKET = "wri-tm-repl";

/**
 * Parses the CSV at the given. In local development, the path is expected to be on the local
 * filesystem. In AWS, the path should be a file in the wri-tm-repl S3 bucket.
 *
 * To get a reference to the FileService use > service = await resolve(FileService)
 */
export const parseCsv = async (fileService: FileService, path: string, onRow: CsvRowCallback) => {
  const bucket = process.env.NODE_ENV === "production" ? REPL_BUCKET : undefined;
  await fileService.parseCsv(onRow, path, bucket);
};
