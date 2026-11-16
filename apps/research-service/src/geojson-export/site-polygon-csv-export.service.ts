import { Injectable } from "@nestjs/common";
import { SitePolygon, SitePolygonData } from "@terramatch-microservices/database/entities";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { streamZip } from "@terramatch-microservices/common/util/zip-stream";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { Archiver } from "archiver";
import { Dictionary } from "lodash";
import { PassThrough } from "node:stream";
import { Op } from "sequelize";
import { GeoJsonExportAttributes } from "./dto/geojson-export-request.dto";
import { GeoJsonExportService } from "./geojson-export.service";
import { GeoJsonExportQueryBuilder } from "./geojson-export-query.builder";

export type SitePolygonExportFormat = "geojson" | "csv" | "zip";

export const SITE_POLYGON_EXPORT_FILE_PREFIX = "site-polygons";

const EXPORT_BATCH_SIZE = 500;

// Always present in the header, even when the scope has no polygons.
const BASE_COLUMNS = ["uuid", "polyName", "plantStart", "practice", "targetSys", "distr", "numTrees", "siteId"];

type ExportRow = { properties: Record<string, unknown>; extra: Record<string, unknown> };

@Injectable()
export class SitePolygonCsvExportService {
  constructor(
    private readonly csvExportService: CsvExportService,
    private readonly geoJsonExportService: GeoJsonExportService
  ) {}

  /**
   * Writes the export for the scope in the requested format to the destination. The GeoJSON branch is the
   * existing streaming writer; CSV and zip are built on top of it.
   */
  async writeExport(
    format: SitePolygonExportFormat,
    scope: GeoJsonExportAttributes,
    destination: NodeJS.WritableStream,
    onProgress: (processed: number, total: number) => Promise<void>
  ) {
    if (format === "csv") return await this.writeCsv(scope, destination, onProgress);
    if (format === "zip") return await this.writeZip(scope, destination, onProgress);
    return await this.geoJsonExportService.writeFeatureCollection(destination, scope, onProgress);
  }

  /**
   * Writes one row per polygon. Each row holds the polygon attributes plus every key stored in its
   * extra attributes (site_polygon_data), which become their own columns. The columns depend on the whole
   * scope, so a first pass collects them before the second pass writes the rows.
   */
  async writeCsv(
    scope: GeoJsonExportAttributes,
    destination: NodeJS.WritableStream,
    onProgress?: (processed: number, total: number) => Promise<void>
  ) {
    const columnNames = new Set<string>(BASE_COLUMNS);
    for await (const sitePolygons of batchFindAll(await this.buildQuery(scope))) {
      for (const { properties, extra } of await this.buildRows(sitePolygons)) {
        Object.keys(properties).forEach(key => columnNames.add(key));
        Object.keys(extra).forEach(key => columnNames.add(key));
      }
    }
    const columns: Dictionary<string> = Object.fromEntries([...columnNames].map(name => [name, name]));

    const query = await this.buildQuery(scope);
    const total = await query.paginationTotal();
    await onProgress?.(0, total);

    let processed = 0;
    await this.csvExportService.writeToStream(destination, columns, async addRow => {
      for await (const sitePolygons of batchFindAll(query)) {
        for (const { properties, extra } of await this.buildRows(sitePolygons)) {
          // Later sources override earlier ones, so fixed properties win over stored extra keys.
          addRow(extra, properties);
        }
        processed += sitePolygons.length;
        await onProgress?.(processed, total);
      }
    });
  }

  /**
   * Writes a zip with the GeoJSON FeatureCollection and the CSV for the same scope.
   */
  async writeZip(
    scope: GeoJsonExportAttributes,
    destination: NodeJS.WritableStream,
    onProgress: (processed: number, total: number) => Promise<void>
  ) {
    await streamZip(destination, async archive => {
      await this.appendGeoJson(archive, scope, onProgress);
      await this.appendCsv(archive, scope);
    });
  }

  private async appendGeoJson(
    archive: Archiver,
    scope: GeoJsonExportAttributes,
    onProgress: (processed: number, total: number) => Promise<void>
  ) {
    const entry = new PassThrough();
    archive.append(entry, { name: `${SITE_POLYGON_EXPORT_FILE_PREFIX}.geojson` });
    try {
      await this.geoJsonExportService.writeFeatureCollection(entry, scope, onProgress);
    } finally {
      entry.end();
    }
  }

  private async appendCsv(archive: Archiver, scope: GeoJsonExportAttributes) {
    const entry = new PassThrough();
    archive.append(entry, { name: `${SITE_POLYGON_EXPORT_FILE_PREFIX}.csv` });
    // writeToStream ends the stringifier when done, which ends the entry.
    await this.writeCsv(scope, entry);
  }

  private async buildQuery(scope: GeoJsonExportAttributes) {
    const { projectUuids, siteUuids, polygonUuids } = scope;
    const builder = new GeoJsonExportQueryBuilder(EXPORT_BATCH_SIZE);
    if (projectUuids != null) await builder.filterProjectUuids(projectUuids);
    if (siteUuids != null) await builder.filterSiteUuids(siteUuids);
    if (polygonUuids != null) await builder.filterPolygonUuids(polygonUuids);
    return builder;
  }

  private async buildRows(sitePolygons: SitePolygon[]): Promise<ExportRow[]> {
    const extendedDataMap = await this.loadExtendedDataMap(sitePolygons);
    const { keysByFramework, valuesByUuid } =
      await this.geoJsonExportService.loadCustomAttributeExportContext(sitePolygons);

    return sitePolygons.map(sitePolygon => ({
      // The same property builder as the GeoJSON export, so shared columns cannot drift from it.
      properties: this.geoJsonExportService.buildProperties(
        sitePolygon,
        false,
        null,
        null,
        keysByFramework,
        valuesByUuid
      ),
      extra: extendedDataMap.get(sitePolygon.uuid) ?? {}
    }));
  }

  private async loadExtendedDataMap(sitePolygons: SitePolygon[]) {
    const extendedDataMap = new Map<string, Record<string, unknown>>();
    if (sitePolygons.length === 0) return extendedDataMap;

    const records = await SitePolygonData.findAll({
      where: { sitePolygonUuid: { [Op.in]: sitePolygons.map(({ uuid }) => uuid) } },
      attributes: ["sitePolygonUuid", "data"]
    });
    for (const { sitePolygonUuid, data } of records) {
      if (data != null) extendedDataMap.set(sitePolygonUuid, data as Record<string, unknown>);
    }
    return extendedDataMap;
  }
}
