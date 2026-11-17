import { Disturbance } from "@terramatch-microservices/database/entities";
import { SitePolygonColumnQueryBuilder } from "./site-polygon-column-query.builder";

export const MAP_INDEX_ATTRIBUTES = [
  "uuid",
  "polygonUuid",
  "siteUuid",
  "status",
  "polyName",
  "numTrees",
  "calcArea",
  "validationStatus",
  "practice",
  "targetSys"
] as const;

export class SitePolygonMapIndexQueryBuilder extends SitePolygonColumnQueryBuilder {
  constructor() {
    super(undefined);
    this.attributes([...MAP_INDEX_ATTRIBUTES]);
    this.findOptions.include = [
      {
        model: Disturbance,
        attributes: ["disturbanceableType", Disturbance.disturbanceReportUuidAttribute()],
        required: false
      }
    ];
  }
}
