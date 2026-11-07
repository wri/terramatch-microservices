import { Site } from "@terramatch-microservices/database/entities";
import { SitePolygonColumnQueryBuilder } from "../site-polygons/site-polygon-column-query.builder";

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

export class GeoJsonExportQueryBuilder extends SitePolygonColumnQueryBuilder {
  constructor(pageSize: number) {
    super(pageSize);
    this.attributes([...GEOJSON_EXPORT_ATTRIBUTES]);
    this.findOptions.include = [{ model: Site, attributes: GEOJSON_EXPORT_SITE_ATTRIBUTES }];
  }
}
