import { Site } from "@terramatch-microservices/database/entities";
import { SitePolygonColumnQueryBuilder } from "../site-polygons/site-polygon-column-query.builder";
import { applySitePolygonFilters } from "../site-polygons/site-polygon-scope-filters";
import { buildSitePolygonSortOrder } from "../site-polygons/site-polygon-sort";
import { GeoJsonExportAttributes } from "./dto/geojson-export-request.dto";

export const GEOJSON_EXPORT_ATTRIBUTES = [
  "id",
  "uuid",
  "polygonUuid",
  "siteUuid",
  "polyName",
  "plantStart",
  "practice",
  "targetSys",
  "distr",
  "numTrees"
] as const;

export const GEOJSON_EXPORT_SITE_ATTRIBUTES = ["uuid", "name", "ppcExternalId", "frameworkKey"];

export const EXPORT_BATCH_SIZE = 500;

export class GeoJsonExportQueryBuilder extends SitePolygonColumnQueryBuilder {
  constructor(pageSize: number) {
    super(pageSize);
    this.attributes([...GEOJSON_EXPORT_ATTRIBUTES]);
    // The project is joined for the projectName sort. It is a belongsTo, so it never multiplies rows.
    this.findOptions.include = [
      {
        model: Site,
        attributes: GEOJSON_EXPORT_SITE_ATTRIBUTES,
        include: [{ association: "project", attributes: ["name"] }]
      }
    ];
  }

  /**
   * Limits the export to the requested scope (project, site or polygon UUIDs), applies the table filters and
   * sort. Batches are paged by offset, so the id tiebreaker keeps the rows in one stable order across pages.
   */
  async filterExportScope({ projectUuids, siteUuids, polygonUuids, sort, ...filters }: GeoJsonExportAttributes) {
    if (projectUuids != null) await this.filterProjectUuids(projectUuids);
    if (siteUuids != null) await this.filterSiteUuids(siteUuids);
    if (polygonUuids != null) await this.filterPolygonUuids(polygonUuids);
    await applySitePolygonFilters(this, filters);
    if (sort?.field != null) {
      this.order([...buildSitePolygonSortOrder(sort.field, sort.direction ?? "ASC"), ["id", "ASC"]]);
    }
    return this;
  }
}

/** The filtered, sorted export query shared by the GeoJSON and CSV writers, optionally limited to some columns. */
export async function buildExportQuery(scope: GeoJsonExportAttributes, attributes?: string[]) {
  const builder = new GeoJsonExportQueryBuilder(EXPORT_BATCH_SIZE);
  if (attributes != null) builder.attributes(attributes);
  return await builder.filterExportScope(scope);
}
