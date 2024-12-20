import { Attributes, Filterable, FindOptions, IncludeOptions, literal, Op, WhereOptions } from "sequelize";
import {
  IndicatorOutputFieldMonitoring,
  IndicatorOutputHectares,
  IndicatorOutputMsuCarbon,
  IndicatorOutputTreeCount,
  IndicatorOutputTreeCover,
  IndicatorOutputTreeCoverLoss,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { IndicatorSlug, PolygonStatus } from "@terramatch-microservices/database/constants";
import { uniq } from "lodash";
import { BadRequestException } from "@nestjs/common";

type IndicatorModelClass =
  | typeof IndicatorOutputTreeCover
  | typeof IndicatorOutputTreeCoverLoss
  | typeof IndicatorOutputHectares
  | typeof IndicatorOutputTreeCount
  | typeof IndicatorOutputFieldMonitoring
  | typeof IndicatorOutputMsuCarbon;

export const INDICATOR_MODEL_CLASSES: { [Slug in IndicatorSlug]: IndicatorModelClass } = {
  treeCover: IndicatorOutputTreeCover,
  treeCoverLoss: IndicatorOutputTreeCoverLoss,
  treeCoverLossFires: IndicatorOutputTreeCoverLoss,
  restorationByEcoRegion: IndicatorOutputHectares,
  restorationByStrategy: IndicatorOutputHectares,
  restorationByLandUse: IndicatorOutputHectares,
  treeCount: IndicatorOutputTreeCount,
  earlyTreeVerification: IndicatorOutputTreeCount,
  fieldMonitoring: IndicatorOutputFieldMonitoring,
  msuCarbon: IndicatorOutputMsuCarbon
};

const INDICATOR_EXCLUDE_COLUMNS = ["id", "sitePolygonId", "createdAt", "updatedAt", "deletedAt"];

export class SitePolygonQueryBuilder {
  private siteJoin: IncludeOptions = {
    model: Site,
    include: [
      { association: "treesPlanted", attributes: ["name", "amount"] },
      {
        model: SiteReport,
        include: [{ association: "treesPlanted", attributes: ["name", "amount"] }],
        attributes: ["dueAt", "submittedAt"]
      }
    ],
    attributes: ["projectId"],
    required: true
  };

  private findOptions: FindOptions<Attributes<SitePolygon>> = {
    include: [
      { model: IndicatorOutputFieldMonitoring, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputHectares, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputMsuCarbon, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputTreeCount, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputTreeCover, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputTreeCoverLoss, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: PolygonGeometry, attributes: ["polygon"], required: true },
      this.siteJoin
    ]
  };

  constructor(pageSize: number) {
    this.findOptions.limit = pageSize;
  }

  async excludeTestProjects() {
    // avoid joining against the entire project table by doing a quick query first. The number of test projects is small
    const testProjects = await Project.findAll({ where: { isTest: true }, attributes: ["id"] });
    this.where({ projectId: { [Op.notIn]: testProjects.map(({ id }) => id) } }, this.siteJoin);
    return this;
  }

  async filterProjectUuids(projectUuids: string[]) {
    const filterProjects = await Project.findAll({
      where: { uuid: { [Op.in]: projectUuids } },
      attributes: ["id"]
    });
    this.where({ projectId: { [Op.in]: filterProjects.map(({ id }) => id) } }, this.siteJoin);
    return this;
  }

  hasStatuses(polygonStatuses?: PolygonStatus[]) {
    if (polygonStatuses != null) this.where({ status: { [Op.in]: polygonStatuses } });
    return this;
  }

  modifiedSince(date?: Date) {
    if (date != null) this.where({ updatedAt: { [Op.gte]: date } });
    return this;
  }

  isMissingIndicators(indicatorSlugs?: IndicatorSlug[]) {
    if (indicatorSlugs != null) {
      const literals = uniq(indicatorSlugs).map(slug => {
        const table = INDICATOR_MODEL_CLASSES[slug]?.tableName;
        if (table == null) throw new BadRequestException(`Unrecognized indicator slug: ${slug}`);

        return literal(
          `(SELECT COUNT(*) = 0 from ${table} WHERE indicator_slug = "${slug}" AND site_polygon_id = SitePolygon.id)`
        );
      });
      this.where({ [Op.and]: literals });
    }
    return this;
  }

  async touchesBoundary(polygonUuid?: string) {
    if (polygonUuid != null) {
      // This check isn't strictly necessary for constructing the query, but we do want to throw a useful
      // error to the caller if the polygonUuid doesn't exist, and simply mixing it into the query won't
      // do it
      if ((await PolygonGeometry.count({ where: { uuid: polygonUuid } })) === 0) {
        throw new BadRequestException(`Unrecognized polygon UUID: ${polygonUuid}`);
      }

      this.where({
        [Op.and]: [
          literal(
            `(SELECT ST_INTERSECTS(polygon.geom, (SELECT geom FROM polygon_geometry WHERE uuid = "${polygonUuid}")))`
          )
        ]
      });
    }
    return this;
  }

  async pageAfter(pageAfter: string) {
    const sitePolygon = await SitePolygon.findOne({
      where: { uuid: pageAfter },
      attributes: ["id"]
    });
    if (sitePolygon == null) throw new BadRequestException("pageAfter polygon not found");
    this.where({ id: { [Op.gt]: sitePolygon.id } });
    return this;
  }

  async execute(): Promise<SitePolygon[]> {
    return await SitePolygon.findAll(this.findOptions);
  }

  private where(options: WhereOptions, filterable: Filterable = this.findOptions) {
    if (filterable.where == null) filterable.where = {};

    const clauses = { ...options };
    if (clauses[Op.and] != null && filterable.where[Op.and] != null) {
      // For this builder, we only use arrays of literals with Op.and, so we can simply merge the arrays
      clauses[Op.and] = [...filterable.where[Op.and], ...clauses[Op.and]];
    }

    Object.assign(filterable.where, clauses);
  }
}
