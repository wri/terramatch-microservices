import { IncludeOptions, literal, Op, Sequelize } from "sequelize";
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
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";
import { ModelCtor, ModelStatic } from "sequelize-typescript";

type IndicatorModel =
  | IndicatorOutputTreeCover
  | IndicatorOutputTreeCoverLoss
  | IndicatorOutputHectares
  | IndicatorOutputTreeCount
  | IndicatorOutputFieldMonitoring
  | IndicatorOutputMsuCarbon;

type IndicatorClass<T extends IndicatorModel> = ModelCtor<T> & ModelStatic<T>;
export const INDICATOR_MODEL_CLASSES: { [Slug in IndicatorSlug]: IndicatorClass<IndicatorModel> } = {
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

export class SitePolygonQueryBuilder extends PaginatedQueryBuilder<SitePolygon> {
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
    attributes: ["projectId", "name"],
    required: true
  };

  constructor(pageSize: number) {
    super(SitePolygon, pageSize);

    this.findOptions.include = [
      { model: IndicatorOutputFieldMonitoring, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputHectares, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputMsuCarbon, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputTreeCount, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputTreeCover, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: IndicatorOutputTreeCoverLoss, attributes: { exclude: INDICATOR_EXCLUDE_COLUMNS } },
      { model: PolygonGeometry, attributes: ["polygon"], required: true },
      this.siteJoin
    ];

    this.where({ isActive: true });
  }

  async excludeTestProjects() {
    // avoid joining against the entire project table by doing a quick query first. The number of test projects is small
    const testProjects = await Project.findAll({ where: { isTest: true }, attributes: ["id"] });
    return this.where({ projectId: { [Op.notIn]: testProjects.map(({ id }) => id) } }, this.siteJoin);
  }

  async filterSiteUuids(siteUuids: string[]) {
    return this.where({ siteUuid: { [Op.in]: siteUuids } });
  }
  async filterProjectUuids(projectUuids: string[]) {
    const filterProjects = await Project.findAll({
      where: { uuid: { [Op.in]: projectUuids } },
      attributes: ["id"]
    });
    return this.where({ projectId: { [Op.in]: filterProjects.map(({ id }) => id) } }, this.siteJoin);
  }
  async addSearch(searchTerm: string) {
    if (!searchTerm) return this;

    return this.where(
      Sequelize.or(
        Sequelize.where(Sequelize.col("site.name"), {
          [Op.like]: `${searchTerm}%`
        }),
        Sequelize.where(Sequelize.col("site.name"), {
          [Op.like]: `% ${searchTerm}%`
        }),
        Sequelize.where(Sequelize.col("poly_name"), {
          [Op.like]: `${searchTerm}%`
        }),
        Sequelize.where(Sequelize.col("poly_name"), {
          [Op.like]: `% ${searchTerm}%`
        })
      ),
      this.siteJoin
    );
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
        const model = INDICATOR_MODEL_CLASSES[slug];
        if (!model) throw new BadRequestException(`Unrecognized indicator slug: ${slug}`);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const sequelize = model.sequelize!;
        const tableName = model.tableName;
        return literal(
          `(SELECT COUNT(*) = 0 FROM ${tableName} WHERE indicator_slug = ${sequelize.escape(
            slug
          )} AND site_polygon_id = SitePolygon.id)`
        );
      });
      this.where({ [Op.and]: literals });
    }
    return this;
  }
  hasPresentIndicators(indicatorSlugs?: IndicatorSlug[]) {
    if (indicatorSlugs != null) {
      const literals = uniq(indicatorSlugs).map(slug => {
        const model = INDICATOR_MODEL_CLASSES[slug];
        if (!model) throw new BadRequestException(`Unrecognized indicator slug: ${slug}`);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const sequelize = model.sequelize!;
        const tableName = model.tableName;
        return literal(
          `(SELECT COUNT(*) > 0 from ${tableName} WHERE indicator_slug = ${sequelize.escape(
            slug
          )} AND site_polygon_id = SitePolygon.id)`
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
}
