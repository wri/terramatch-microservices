import { BadRequestException, Injectable, NotFoundException, Type } from "@nestjs/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  IndicatorDto,
  ReportingPeriodDto,
  SitePolygonFullDto,
  SitePolygonLightDto,
  TreeSpeciesDto
} from "./dto/site-polygon.dto";
import { INDICATOR_DTOS } from "./dto/indicators.dto";
import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { pick } from "lodash";
import { INDICATOR_MODEL_CLASSES, SitePolygonQueryBuilder } from "./site-polygon-query.builder";
import { Transaction } from "sequelize";
import { CursorPage, isCursorPage, isNumberPage, NumberPage } from "@terramatch-microservices/common/dto/page.dto";

@Injectable()
export class SitePolygonsService {
  async buildQuery(page: CursorPage | NumberPage) {
    const builder = new SitePolygonQueryBuilder(page.size);
    if ((page as CursorPage).after != null && (page as NumberPage).number != null) {
      throw new BadRequestException("page[after] or page[number] may be provided, but not both.");
    }

    if (isNumberPage(page) && page.number != null) builder.pageNumber(page.number);
    else if (isCursorPage(page) && page.after != null) await builder.pageAfter(page.after);
    return builder;
  }

  async getIndicators(sitePolygon: SitePolygon): Promise<IndicatorDto[]> {
    const accessor = new ModelPropertiesAccessor();
    const indicators: IndicatorDto[] = [];
    for (const indicator of await sitePolygon.getIndicators()) {
      const DtoPrototype = INDICATOR_DTOS[indicator.indicatorSlug];
      const fields = accessor.getModelProperties(DtoPrototype.prototype as unknown as Type<unknown>);
      indicators.push(pick(indicator, fields) as typeof DtoPrototype.prototype);
    }

    return indicators;
  }

  async getEstablishmentTreeSpecies(sitePolygon: SitePolygon): Promise<TreeSpeciesDto[]> {
    // These associations are expected to be eager loaded, so this should not result in new SQL
    // queries.
    const site = await sitePolygon.loadSite();
    if (site == null) return [];

    return (await site.loadTreesPlanted()).map(({ name, amount }) => ({ name, amount }));
  }

  async getReportingPeriods(sitePolygon: SitePolygon): Promise<ReportingPeriodDto[]> {
    // These associations are expected to be eager loaded, so this should not result in new SQL
    // queries
    const site = await sitePolygon.loadSite();
    if (site == null) return [];

    const reportingPeriods: ReportingPeriodDto[] = [];
    for (const report of await site.loadReports()) {
      reportingPeriods.push({
        dueAt: report.dueAt,
        submittedAt: report.submittedAt,
        treeSpecies: (await report.loadTreesPlanted()).map(({ name, amount }) => ({ name, amount }))
      });
    }

    return reportingPeriods;
  }
  async updateIndicator(sitePolygonUuid: string, indicator: IndicatorDto, transaction?: Transaction): Promise<void> {
    const accessor = new ModelPropertiesAccessor();
    const { id: sitePolygonId } = (await SitePolygon.findOne({ where: { uuid: sitePolygonUuid } })) ?? {};
    if (sitePolygonId == null) {
      throw new NotFoundException(`SitePolygon not found for id: ${sitePolygonUuid}`);
    }

    const { indicatorSlug, yearOfAnalysis } = indicator;
    const IndicatorClass = INDICATOR_MODEL_CLASSES[indicatorSlug];
    if (IndicatorClass == null) {
      throw new BadRequestException(`Model not found for indicator: ${indicatorSlug}`);
    }

    const model =
      (await IndicatorClass.findOne({
        where: { sitePolygonId, indicatorSlug, yearOfAnalysis }
      })) ?? new IndicatorClass();
    if (model.sitePolygonId == null) model.sitePolygonId = sitePolygonId;

    const DtoPrototype = INDICATOR_DTOS[indicatorSlug];
    const fields = accessor.getModelProperties(DtoPrototype.prototype as unknown as Type<unknown>);
    Object.assign(model, pick(indicator, fields));
    await model.save({ transaction });
  }

  async transaction<TReturn>(callback: (transaction: Transaction) => Promise<TReturn>) {
    const transaction = await SitePolygon.sequelize.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }
  async buildLightDto(sitePolygon: SitePolygon): Promise<SitePolygonLightDto> {
    const indicators = await this.getIndicators(sitePolygon);
    return new SitePolygonLightDto(sitePolygon, indicators);
  }

  async buildFullDto(sitePolygon: SitePolygon): Promise<SitePolygonFullDto> {
    const indicators = await this.getIndicators(sitePolygon);
    const establishmentTreeSpecies = await this.getEstablishmentTreeSpecies(sitePolygon);
    const reportingPeriods = await this.getReportingPeriods(sitePolygon);
    return new SitePolygonFullDto(sitePolygon, indicators, establishmentTreeSpecies, reportingPeriods);
  }
}
