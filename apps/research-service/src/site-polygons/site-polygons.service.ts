import { BadRequestException, Injectable, Type } from "@nestjs/common";
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
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { Attributes, Filterable, FindOptions, IncludeOptions, literal, Op, WhereOptions } from "sequelize";
import { IndicatorDto, ReportingPeriodDto, TreeSpeciesDto } from "./dto/site-polygon.dto";
import { INDICATOR_DTOS } from "./dto/indicators.dto";
import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { pick, uniq } from "lodash";
import { IndicatorSlug, PolygonStatus } from "@terramatch-microservices/database/constants";

const INDICATOR_TABLES: { [Slug in IndicatorSlug]: string } = {
  treeCover: "indicator_output_tree_cover",
  treeCoverLoss: "indicator_output_tree_cover_loss",
  treeCoverLossFires: "indicator_output_tree_cover_loss",
  restorationByEcoRegion: "indicator_output_hectares",
  restorationByStrategy: "indicator_output_hectares",
  restorationByLandUse: "indicator_output_hectares",
  treeCount: "indicator_output_tree_count",
  earlyTreeVerification: "indicator_output_tree_count",
  fieldMonitoring: "indicator_output_field_monitoring",
  msuCarbon: "indicator_output_msu_carbon"
};

const INDICATOR_EXCLUDE_COLUMNS = ["id", "sitePolygonId", "createdAt", "updatedAt", "deletedAt"];

export class SitePolygonQueryBuilder {
  private siteJoin: IncludeOptions = {
    model: Site,
    include: [
      { model: TreeSpecies, attributes: ["name", "amount"] },
      {
        model: SiteReport,
        include: [{ model: TreeSpecies, attributes: ["name", "amount"] }],
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
    const filterProjects = await Project.findAll({ where: { uuid: { [Op.in]: projectUuids } }, attributes: ["id"] });
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
        const table = INDICATOR_TABLES[slug];
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
    const sitePolygon = await SitePolygon.findOne({ where: { uuid: pageAfter }, attributes: ["id"] });
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

@Injectable()
export class SitePolygonsService {
  async buildQuery(pageSize: number, pageAfter?: string) {
    const builder = new SitePolygonQueryBuilder(pageSize);
    if (pageAfter != null) await builder.pageAfter(pageAfter);
    return builder;
  }

  async getIndicators(sitePolygon: SitePolygon): Promise<IndicatorDto[]> {
    const accessor = new ModelPropertiesAccessor();
    const indicators: IndicatorDto[] = [];
    for (const indicator of await sitePolygon.getIndicators()) {
      const DtoPrototype = INDICATOR_DTOS[indicator.indicatorSlug];
      const fields = accessor.getModelProperties(DtoPrototype as unknown as Type<unknown>);
      indicators.push(pick(indicator, fields) as typeof DtoPrototype);
    }

    return indicators;
  }

  async getEstablishmentTreeSpecies(sitePolygon: SitePolygon): Promise<TreeSpeciesDto[]> {
    // These associations are expected to be eager loaded, so this should not result in new SQL
    // queries.
    const site = await sitePolygon.loadSite();
    if (site == null) return [];

    return (await site.loadTreeSpecies()).map(({ name, amount }) => ({ name, amount }));
  }

  async getReportingPeriods(sitePolygon: SitePolygon): Promise<ReportingPeriodDto[]> {
    // These associations are expected to be eager loaded, so this should not result in new SQL
    // queries
    const site = await sitePolygon.loadSite();
    if (site == null) return [];

    const reportingPeriods: ReportingPeriodDto[] = [];
    for (const report of await site.loadSiteReports()) {
      reportingPeriods.push({
        dueAt: report.dueAt,
        submittedAt: report.submittedAt,
        treeSpecies: (await report.loadTreeSpecies()).map(({ name, amount }) => ({ name, amount }))
      });
    }

    return reportingPeriods;
  }
}
