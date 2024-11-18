import { BadRequestException, Injectable, Type } from "@nestjs/common";
import { Project, Site, SitePolygon, SiteReport } from "@terramatch-microservices/database/entities";
import { Attributes, FindOptions, IncludeOptions, Op, WhereOptions } from "sequelize";
import { IndicatorDto, ReportingPeriodDto, TreeSpeciesDto } from "./dto/site-polygon.dto";
import { INDICATOR_DTOS } from "./dto/indicators.dto";
import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { pick } from "lodash";
import { PolygonStatus } from "@terramatch-microservices/database/constants";

export class SitePolygonQueryBuilder {
  private siteJoin: IncludeOptions = {
    model: Site,
    include: ["treeSpecies", { model: SiteReport, include: ["treeSpecies"] }],
    required: true
  };
  private findOptions: FindOptions<Attributes<SitePolygon>> = {
    include: [
      "indicatorsFieldMonitoring",
      "indicatorsHectares",
      "indicatorsMsuCarbon",
      "indicatorsTreeCount",
      "indicatorsTreeCover",
      "indicatorsTreeCoverLoss",
      "polygon",
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

  filterPolygonStatuses(polygonStatuses: PolygonStatus[]) {
    this.where({ status: { [Op.in]: polygonStatuses } });
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

  private where(options: WhereOptions, include?: IncludeOptions) {
    let where: WhereOptions;
    if (include != null) {
      if (include.where == null) include.where = {};
      where = include.where;
    } else {
      if (this.findOptions.where == null) this.findOptions.where = {};
      where = this.findOptions.where;
    }
    Object.assign(where, options);
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
