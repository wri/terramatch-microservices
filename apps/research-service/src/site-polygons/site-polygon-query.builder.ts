import { IncludeOptions, Op, WhereOptions } from "sequelize";
import {
  Disturbance,
  LandscapeGeometry,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { BadRequestException } from "@nestjs/common";
import { omit } from "lodash";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { SITE_POLYGON_SEARCH_FIELDS, SitePolygonSearchField } from "./dto/site-polygon-query.dto";
import { SitePolygonColumnQueryBuilder } from "./site-polygon-column-query.builder";

export { INDICATOR_MODEL_CLASSES } from "./site-polygon-column-query.builder";

export type SitePolygonQueryBuilderOptions = {
  includeGeometry?: boolean;
};

/**
 * Joined SitePolygon query used by the paginated index and DTO builders.
 *
 * Extends the column filter surface with site/project/geometry/disturbance includes. Filters that
 * target joined tables attach their WHERE to the site include so Sequelize cannot drop them.
 */
export class SitePolygonQueryBuilder extends SitePolygonColumnQueryBuilder {
  private readonly includeGeometry: boolean;

  private polygonGeometryJoin: IncludeOptions = {
    model: PolygonGeometry,
    attributes: ["polygon"]
  };

  private siteJoin: IncludeOptions = {
    model: Site,
    include: [{ association: "project", attributes: ["uuid", "shortName", "name", "level0Project"] }],
    attributes: ["id", "projectId", "name", "ppcExternalId"],
    required: true
  };

  private disturbanceJoin: IncludeOptions = {
    model: Disturbance,
    attributes: ["id", "disturbanceableId", "disturbanceableType"],
    required: false
  };

  constructor(pageSize?: number, options: SitePolygonQueryBuilderOptions = {}) {
    super(pageSize);

    this.includeGeometry = options.includeGeometry !== false;
    this.findOptions.include = [
      ...(this.includeGeometry ? [this.polygonGeometryJoin] : []),
      this.disturbanceJoin,
      this.siteJoin
    ];
  }

  async paginationTotal() {
    const { include, ...rest } = this.findOptions;
    const includes = (Array.isArray(include) ? include : include != null ? [include] : []).filter(inc => {
      if (inc == null || typeof inc !== "object" || !("model" in inc)) return true;
      return (inc as IncludeOptions).model !== PolygonGeometry;
    });

    return await SitePolygon.count({
      distinct: true,
      ...omit(rest, ["limit", "offset", "order"]),
      include: includes
    });
  }

  override includeSoftDeleted(): this {
    super.includeSoftDeleted();
    this.polygonGeometryJoin.paranoid = false;
    return this;
  }

  async excludeTestProjects() {
    // Avoid joining against the entire project table by doing a quick query first. The number of test projects is small
    const testProjects = Subquery.select(Project, "id").eq("isTest", true).literal;
    return this.where({ projectId: { [Op.notIn]: testProjects } }, this.siteJoin);
  }

  async filterProjectAttributes(cohort?: string[], slug?: LandscapeSlug) {
    let landscapeValue: string | null = null;
    if (slug != null) {
      const landscape = await LandscapeGeometry.findOne({ where: { slug }, attributes: ["landscape"] });
      if (landscape == null) {
        throw new BadRequestException(`Unrecognized landscape slug: ${slug}`);
      }
      landscapeValue = landscape.landscape;
    }

    const subquery = Subquery.select(Project, "id");
    if (slug != null && landscapeValue != null) {
      subquery.isNotNull("landscape").eq("landscape", landscapeValue);
    }

    if (cohort != null && cohort.length > 0) {
      const whereConditions: WhereOptions[] = [{ cohort: { [Op.in]: cohort } }];

      if (slug != null && landscapeValue != null) {
        whereConditions.push({ landscape: landscapeValue });
      }

      const projects = await Project.findAll({
        where: {
          [Op.and]: whereConditions
        },
        attributes: ["id"]
      });

      return this.where({ projectId: { [Op.in]: projects.map(p => p.id) } }, this.siteJoin);
    }

    return this.where({ projectId: { [Op.in]: subquery.literal } }, this.siteJoin);
  }

  async filterProjectShortNames(projectShortNames: string[]) {
    const filterProjects = await Project.findAll({
      where: { shortName: { [Op.in]: projectShortNames } },
      attributes: ["id"]
    });
    return this.where({ projectId: { [Op.in]: filterProjects.map(({ id }) => id) } }, this.siteJoin);
  }

  async filterProjectUuids(projectUuids: string[]) {
    const filterProjects = await Project.findAll({
      where: { uuid: { [Op.in]: projectUuids } },
      attributes: ["id"]
    });
    return this.where({ projectId: { [Op.in]: filterProjects.map(({ id }) => id) } }, this.siteJoin);
  }

  async addSearch(searchTerm: string, fields?: SitePolygonSearchField[]) {
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
