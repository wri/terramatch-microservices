import { Response } from "express";
import { timestampFileName } from "./filenames";
import archiver, { Archiver } from "archiver";
import { TMLogger } from "./tm-logger";

const LOGGER = new TMLogger("ResponseZipStream");

export const streamZipToResponse = async (
  filenamePrefix: string,
  response: Response,
  archiveFiller: (archive: Archiver) => Promise<void>
) => {
  response.set({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(timestampFileName(filenamePrefix, ".zip"))}"`,
    "Access-Control-Expose-Headers": "Content-Disposition"
  });

  return await new Promise<void>((resolve, reject) => {
    const archive = archiver("zip");
    archive.on("error", reject);
    archive.on("end", resolve);
    archive.on("warning", err => {
      if (err.code === "ENOENT") {
        LOGGER.warn(`Archive warning: ${err.message}`);
      } else {
        reject(err);
      }
    });

    archive.pipe(response);

    archiveFiller(archive)
      .then(() => archive.finalize())
      .catch(reject);
  });
};
