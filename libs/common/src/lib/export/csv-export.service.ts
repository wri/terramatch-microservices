import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { stringify as stringifySync } from "csv-stringify/sync";
import { stringify } from "csv-stringify";
import { FileService } from "../file/file.service";
import { ConfigService } from "@nestjs/config";
import { FileDownloadDto } from "../dto/file-download.dto";
import { Dictionary, pick } from "lodash";
import { Model } from "sequelize";

function serializeCell(value: unknown): string | number {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0] ?? "";
  if (Array.isArray(value)) {
    return value.map(v => (v == null ? "" : serializeCell(v))).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value as string | number;
}

@Injectable()
export class CsvExportService {
  constructor(private readonly fileService: FileService, private readonly configService: ConfigService) {}

  get bucket() {
    const bucket = this.configService.get<string>("AWS_BUCKET");
    if (bucket == null) throw new InternalServerErrorException("AWS_BUCKET is not set");
    return bucket;
  }

  async exportExists(fileName: string) {
    return await this.fileService.remoteFileExists(this.bucket, `exports/${fileName}`);
  }

  async generateDto(fileName: string) {
    return new FileDownloadDto(await this.fileService.generatePresignedUrl(this.bucket, `exports/${fileName}`));
  }

  getStreamWriter(fileName: string, columns: Dictionary<string>) {
    const passThrough = this.fileService.uploadStream(this.bucket, `exports/${fileName}`, "text/csv");
    const stringifier = stringify({ header: true, columns });
    stringifier.pipe(passThrough);

    const keys = Object.keys(columns);
    return {
      addRow: (model: Model, additional?: Dictionary<unknown>) => {
        stringifier.write({ ...pick(model, keys), ...additional });
      },
      close: () => stringifier.end()
    };
  }

  /**
   * @param rows Plain objects whose keys match `columnMap` keys (extras are ignored).
   * @param columnMap field key → CSV header label (column order follows insertion order).
   */
  stringify(rows: Dictionary<unknown>[], columnMap: Dictionary<string>): string {
    const columnsArray = Object.entries(columnMap).map(([key, header]) => ({ key, header }));
    const filteredRows = rows.map(row => {
      const filteredRow: Record<string, string | number> = {};
      for (const { key } of columnsArray) {
        filteredRow[key] = serializeCell(row[key]);
      }
      return filteredRow;
    });
    return stringifySync(filteredRows, { header: true, columns: columnsArray });
  }
}
