import { Injectable } from "@nestjs/common";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Dictionary } from "lodash";
import { col, fn } from "sequelize";
import { GeoJsonExportAttributes, SitePolygonExportFormat } from "./dto/geojson-export-request.dto";
import { GeoJsonExportService } from "./geojson-export.service";
import { buildExportQuery, GeoJsonExportQueryBuilder } from "./geojson-export-query.builder";

const TOTALS_LABEL = "Total";

// CSV columns in output order, keyed by SitePolygon attribute (or "siteName", from the site include), with the
// header written for each.
export const SITE_POLYGON_CSV_COLUMNS: Dictionary<string> = {
  polyName: "Polygon Name",
  siteName: "Site Name",
  status: "Submission",
  validationStatus: "Validation",
  practice: "Restoration Practice",
  targetSys: "Target Land Use System",
  distr: "Tree Distribution",
  plantStart: "Planting Start Date",
  numTrees: "Trees Planted",
  calcArea: "Calculated Area",
  source: "Source"
};

// "id" is needed for the paginated batching. siteName is read from the site include, not a polygon column.
const CSV_ATTRIBUTES = ["id", ...Object.keys(SITE_POLYGON_CSV_COLUMNS).filter(key => key !== "siteName")];

@Injectable()
export class SitePolygonCsvExportService {
  constructor(
    private readonly csvExportService: CsvExportService,
    private readonly geoJsonExportService: GeoJsonExportService
  ) {}

  /**
   * Writes the export for the scope in the requested format to the destination. The GeoJSON branch is the
   * existing streaming writer; CSV has its own fixed columns.
   */
  async writeExport(
    format: SitePolygonExportFormat,
    scope: GeoJsonExportAttributes,
    destination: NodeJS.WritableStream,
    onProgress: (processed: number, total: number) => Promise<void>
  ) {
    if (format === "csv") return await this.writeCsv(scope, destination, onProgress);
    return await this.geoJsonExportService.writeFeatureCollection(destination, scope, onProgress);
  }

  /**
   * Writes one row per polygon with the fixed SITE_POLYGON_CSV_COLUMNS, followed by a totals row for the
   * Trees Planted and Calculated Area columns.
   */
  async writeCsv(
    scope: GeoJsonExportAttributes,
    destination: NodeJS.WritableStream,
    onProgress: (processed: number, total: number) => Promise<void>
  ) {
    const query = await buildExportQuery(scope, CSV_ATTRIBUTES);
    const total = await query.paginationTotal();
    // Totals are computed before the last progress tick so the job isn't reported complete while work remains.
    const totalsRow = await this.buildTotalsRow(query);
    await onProgress(0, total);

    let processed = 0;
    await this.csvExportService.writeToStream(destination, SITE_POLYGON_CSV_COLUMNS, async addRow => {
      for await (const sitePolygons of batchFindAll(query)) {
        for (const sitePolygon of sitePolygons) {
          addRow(sitePolygon, { siteName: sitePolygon.site?.name });
        }
        processed += sitePolygons.length;
        await onProgress(processed, total);
      }

      addRow(totalsRow);
    });
  }

  /** One SQL SUM over the same filtered query, so the totals match the rows above. */
  private async buildTotalsRow(query: GeoJsonExportQueryBuilder) {
    const [totals] = (await SitePolygon.findAll({
      ...query.findOptionsForAggregation([
        [fn("COALESCE", fn("SUM", col("SitePolygon.num_trees")), 0), "numTrees"],
        [fn("COALESCE", fn("SUM", col("SitePolygon.calc_area")), 0), "calcArea"]
      ]),
      raw: true
    })) as unknown as { numTrees: string | number | null; calcArea: string | number | null }[];

    return {
      polyName: TOTALS_LABEL,
      numTrees: Number(totals?.numTrees ?? 0),
      calcArea: Number(totals?.calcArea ?? 0)
    };
  }
}
