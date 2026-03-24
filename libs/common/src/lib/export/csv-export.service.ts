import { Injectable } from "@nestjs/common";
import { stringify } from "csv-stringify/sync";

function serializeCell(value: unknown): string | number {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0] ?? "";
  if (Array.isArray(value)) {
    return value.map(v => (v == null ? "" : String(v))).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value as string | number;
}

@Injectable()
export class CsvExportService {
  /**
   * @param rows Plain objects whose keys match `columnMap` keys (extras are ignored).
   * @param columnMap field key → CSV header label (column order follows insertion order).
   */
  stringify(rows: Record<string, unknown>[], columnMap: Record<string, string>): string {
    const columnsArray = Object.entries(columnMap).map(([key, header]) => ({ key, header }));
    const filteredRows = rows.map(row => {
      const filteredRow: Record<string, string | number> = {};
      for (const { key } of columnsArray) {
        filteredRow[key] = serializeCell(row[key]);
      }
      return filteredRow;
    });
    return stringify(filteredRows, { header: true, columns: columnsArray });
  }
}
