import { Op, WhereOptions } from "sequelize";
import { Disturbance, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { SITE_POLYGON_SEARCH_FIELDS, SitePolygonSearchField } from "./dto/site-polygon-query.dto";
import { SitePolygonColumnQueryBuilder } from "./site-polygon-column-query.builder";

export const MAP_INDEX_ATTRIBUTES = [
  "uuid",
  "polygonUuid",
  "status",
  "polyName",
  "numTrees",
  "calcArea",
  "validationStatus"
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

  async filterProjectUuids(projectUuids: string[]) {
    const siteUuids = Subquery.select(Site, "uuid").in(
      "projectId",
      Subquery.select(Project, "id").in("uuid", projectUuids).literal
    ).literal;
    return this.where({ siteUuid: { [Op.in]: siteUuids } });
  }

  async addSearch(searchTerm: string, fields?: SitePolygonSearchField[]) {
    const selectedFields =
      fields != null && fields.length > 0 ? fields : ([...SITE_POLYGON_SEARCH_FIELDS] as SitePolygonSearchField[]);
    const conditions: WhereOptions[] = [];
    const contains = SitePolygon.sql.escape(`%${searchTerm}%`);

    if (selectedFields.includes("siteName")) {
      const siteUuids = Subquery.select(Site, "uuid").andLiteral(
        `${Subquery.clauseBuilder(Site).field("name")} LIKE ${contains}`
      ).literal;
      conditions.push({ siteUuid: { [Op.in]: siteUuids } });
    }

    if (selectedFields.includes("polyName")) {
      conditions.push({ polyName: { [Op.like]: `%${searchTerm}%` } });
    }

    if (selectedFields.includes("polygonUuid")) {
      conditions.push({ polygonUuid: { [Op.like]: `%${searchTerm}%` } });
    }

    if (conditions.length === 0) return this;

    return this.where({ [Op.or]: conditions });
  }
}
