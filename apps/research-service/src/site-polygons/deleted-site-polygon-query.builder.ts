import { Op, WhereOptions } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Disturbance, PolygonGeometry, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { SITE_POLYGON_SEARCH_FIELDS, SitePolygonSearchField } from "./dto/site-polygon-query.dto";

export class DeletedSitePolygonQueryBuilder extends PaginatedQueryBuilder<SitePolygon> {
  constructor(pageSize?: number) {
    super(SitePolygon, pageSize, [
      { model: PolygonGeometry, attributes: ["polygon"], paranoid: false },
      { model: Disturbance, attributes: ["disturbanceableId"], required: false },
      {
        model: Site,
        include: [{ association: "project", attributes: ["uuid", "shortName", "name", "level0Project"] }],
        attributes: ["id", "projectId", "name", "ppcExternalId"],
        required: true
      }
    ]);

    this.findOptions.paranoid = false;
    this.where({ isActive: true, deletedAt: { [Op.ne]: null } });
    this.order([["deletedAt", "DESC"]]);
  }

  filterSiteUuids(siteUuids: string[]): this {
    return this.where({ siteUuid: { [Op.in]: siteUuids } });
  }

  addSearch(searchTerm: string, fields?: SitePolygonSearchField[]): this {
    const selectedFields =
      fields != null && fields.length > 0 ? fields : ([...SITE_POLYGON_SEARCH_FIELDS] as SitePolygonSearchField[]);
    const conditions: WhereOptions[] = [];

    if (selectedFields.includes("siteName")) {
      conditions.push({ "$site.name$": { [Op.like]: `${searchTerm}%` } });
      conditions.push({ "$site.name$": { [Op.like]: `%${searchTerm}%` } });
    }

    if (selectedFields.includes("polyName")) {
      conditions.push({ polyName: { [Op.like]: `${searchTerm}%` } });
      conditions.push({ polyName: { [Op.like]: `%${searchTerm}%` } });
    }

    if (selectedFields.includes("polygonUuid")) {
      conditions.push({ polygonUuid: { [Op.like]: `${searchTerm}%` } });
      conditions.push({ polygonUuid: { [Op.like]: `%${searchTerm}%` } });
    }

    if (conditions.length === 0) {
      return this;
    }

    return this.where({ [Op.or]: conditions });
  }
}
