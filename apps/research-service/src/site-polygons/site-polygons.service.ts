import { BadRequestException, Injectable, NotFoundException, Type } from "@nestjs/common";
import {
  Action,
  AuditStatus,
  CriteriaSite,
  PointGeometry,
  PolygonGeometry,
  ProjectPolygon,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import {
  IndicatorDto,
  ReportingPeriodDto,
  SitePolygonFullDto,
  SitePolygonLightDto,
  TreeSpeciesDto
} from "./dto/site-polygon.dto";
import { INDICATOR_DTOS } from "./dto/indicators.dto";
import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { groupBy, pick, uniq } from "lodash";
import { INDICATOR_MODEL_CLASSES, SitePolygonQueryBuilder } from "./site-polygon-query.builder";
import { Op, Transaction } from "sequelize";
import { CursorPage, isCursorPage, isNumberPage, NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { INDICATOR_SLUGS } from "@terramatch-microservices/database/constants";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

type AssociationDtos = {
  indicators?: IndicatorDto[];
  establishmentTreeSpecies?: TreeSpeciesDto[];
  reportingPeriods?: ReportingPeriodDto[];
};

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

  async updateIndicator(sitePolygonUuid: string, indicator: IndicatorDto, transaction?: Transaction): Promise<void> {
    const accessor = new ModelPropertiesAccessor();
    const { id: sitePolygonId } =
      (await SitePolygon.findOne({
        where: { uuid: sitePolygonUuid },
        attributes: ["id"]
      })) ?? {};
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const transaction = await SitePolygon.sequelize!.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  /**
   * Deletes a site polygon and all its associated records following the same pattern as EntityService.
   * This method handles cascade deletion of all related entities in the correct order.
   */
  async deleteSitePolygon(uuid: string): Promise<void> {
    await this.transaction(async transaction => {
      // 1. Find the site polygon
      const sitePolygon = await SitePolygon.findOne({
        where: { uuid },
        include: [
          { model: Site, attributes: ["id", "uuid", "projectId"] },
          { model: PolygonGeometry, attributes: ["id", "uuid"] },
          { model: PointGeometry, attributes: ["id", "uuid"] }
        ],
        transaction
      });

      if (sitePolygon == null) {
        throw new NotFoundException(`SitePolygon not found for uuid: ${uuid}`);
      }

      // 2. Find all related site polygons by primaryUuid (version management)
      const relatedSitePolygons = await SitePolygon.findAll({
        where: { primaryUuid: sitePolygon.primaryUuid },
        attributes: ["id", "uuid", "isActive"],
        transaction
      });

      const sitePolygonIds = relatedSitePolygons.map(sp => sp.id);
      const polygonUuid = sitePolygon.polygonUuid;

      // 3. Delete all indicator records (6 types)
      for (const IndicatorClass of Object.values(INDICATOR_MODEL_CLASSES)) {
        await IndicatorClass.destroy({
          where: { sitePolygonId: { [Op.in]: sitePolygonIds } },
          transaction
        });
      }

      // 4. Delete criteria site records (linked by polygon UUID)
      if (polygonUuid != null) {
        await CriteriaSite.destroy({
          where: { polygonId: polygonUuid },
          transaction
        });
      }

      // 5. Delete audit status records (polymorphic relationship)
      await AuditStatus.destroy({
        where: {
          auditableType: SitePolygon.LARAVEL_TYPE,
          auditableId: { [Op.in]: sitePolygonIds }
        },
        transaction
      });

      // 6. Delete actions (polymorphic relationship)
      await Action.destroy({
        where: {
          targetableType: SitePolygon.LARAVEL_TYPE,
          targetableId: { [Op.in]: sitePolygonIds }
        },
        transaction
      });

      // 7. Delete point geometry if exists
      if (sitePolygon.pointUuid != null) {
        await PointGeometry.destroy({
          where: { uuid: sitePolygon.pointUuid },
          transaction
        });
      }

      // 8. Soft delete site polygons (set isActive = false for active ones)
      const activeSitePolygons = relatedSitePolygons.filter(sp => sp.isActive);
      if (activeSitePolygons.length > 0) {
        await SitePolygon.update(
          { isActive: false },
          {
            where: { id: { [Op.in]: activeSitePolygons.map(sp => sp.id) } },
            transaction
          }
        );
      }

      // 9. Delete polygon geometry
      if (polygonUuid != null) {
        await PolygonGeometry.destroy({
          where: { uuid: polygonUuid },
          transaction
        });
      }

      // 10. Delete project polygon if exists
      if (polygonUuid != null) {
        await ProjectPolygon.destroy({
          where: { polyUuid: polygonUuid },
          transaction
        });
      }

      // TODO: Phase 2 - Update project centroid after deletion
      // This will be implemented in the next phase
    });
  }

  async loadAssociationDtos(sitePolygons: SitePolygon[], lightResource: boolean) {
    const associationDtos: Record<number, AssociationDtos> = {};
    for (const [sitePolygonId, indicators] of Object.entries(await this.getIndicators(sitePolygons))) {
      associationDtos[sitePolygonId] = { indicators };
    }
    if (lightResource) return associationDtos;

    const sites = await this.getSites(sitePolygons);
    const reports = await this.getSiteReports(sitePolygons);
    const { siteTrees, reportTrees } = await this.getTreeSpecies(sitePolygons);
    for (const { id, siteUuid } of sitePolygons) {
      const siteId = sites[siteUuid];
      if (siteId == null) continue;

      associationDtos[id] ??= {};
      associationDtos[id].establishmentTreeSpecies = siteTrees[siteId]?.map(({ name, amount }) => ({
        name: name ?? "",
        amount: amount ?? 0
      }));
      associationDtos[id].reportingPeriods = reports[siteId]?.map(({ id, dueAt, submittedAt }) => {
        const treeSpecies = reportTrees[id]?.map(({ name, amount }) => ({ name: name ?? "", amount: amount ?? 0 }));
        return { dueAt, submittedAt, treeSpecies };
      });
    }

    return associationDtos;
  }

  async buildLightDto(sitePolygon: SitePolygon, { indicators }: AssociationDtos): Promise<SitePolygonLightDto> {
    return new SitePolygonLightDto(sitePolygon, indicators);
  }

  async buildFullDto(
    sitePolygon: SitePolygon,
    { indicators, establishmentTreeSpecies, reportingPeriods }: AssociationDtos
  ): Promise<SitePolygonFullDto> {
    return new SitePolygonFullDto(sitePolygon, indicators, establishmentTreeSpecies, reportingPeriods);
  }

  /**
   * Get a mapping from site polygon ID to the sorted list of indicators for the polygon.
   */
  private async getIndicators(sitePolygons: SitePolygon[]) {
    const results: Record<number, IndicatorDto[]> = {};
    if (sitePolygons.length === 0) return results;

    const accessor = new ModelPropertiesAccessor();
    const sitePolygonIds = sitePolygons.map(({ id }) => id);
    for (const modelClass of uniq(Object.values(INDICATOR_MODEL_CLASSES))) {
      let fields: string[] | undefined = undefined;
      for (const indicator of await modelClass.findAll({ where: { sitePolygonId: { [Op.in]: sitePolygonIds } } })) {
        if (fields === undefined) {
          const DTO = INDICATOR_DTOS[indicator.indicatorSlug];
          fields = accessor.getModelProperties(DTO.prototype as unknown as Type<unknown>);
        }

        results[indicator.sitePolygonId] ??= [];
        let dto = pick(indicator, fields) as IndicatorDto;
        if (
          (dto.indicatorSlug === "treeCoverLoss" || dto.indicatorSlug === "treeCoverLossFires") &&
          dto.value != null
        ) {
          const sitePolygon = sitePolygons.find(sp => sp.id === indicator.sitePolygonId);
          if (sitePolygon?.plantStart != null) {
            const plantStartYear = new Date(sitePolygon.plantStart).getFullYear();
            const startYear = plantStartYear - 10;
            const endYear = plantStartYear;
            dto = {
              ...dto,
              value: Object.fromEntries(
                Object.entries(dto.value).filter(([year]) => {
                  const y = parseInt(year, 10);
                  return y >= startYear && y <= endYear;
                })
              )
            };
          }
        }
        results[indicator.sitePolygonId].push(dto);
      }
    }

    for (const indicators of Object.values(results)) {
      indicators.sort(({ indicatorSlug: slugA }, { indicatorSlug: slugB }) => {
        const indexA = INDICATOR_SLUGS.indexOf(slugA);
        const indexB = INDICATOR_SLUGS.indexOf(slugB);
        return indexA < indexB ? -1 : indexB < indexA ? 1 : 0;
      });
    }

    return results;
  }

  /**
   * Since site polygons use Site UUID, but everything else uses Site ID, we need to pull a mapping
   * between the two to correctly deal with the aggregate data from getTreeSpecies() and getReportingPeriods()
   */
  private async getSites(sitePolygons: SitePolygon[]) {
    if (sitePolygons.length === 0) return {};

    const sites = await Site.findAll({
      where: { uuid: { [Op.in]: sitePolygons.map(({ siteUuid }) => siteUuid) } },
      attributes: ["id", "uuid"]
    });
    return sites.reduce(
      (mapping, { id, uuid }) => ({
        ...mapping,
        [uuid]: id
      }),
      {} as Record<string, number>
    );
  }

  /**
   * Get two mappings of tree species sets: one of reports by report id, and the other of sites by site id.
   */
  private async getTreeSpecies(sitePolygons: SitePolygon[]) {
    if (sitePolygons.length === 0) return { siteTrees: {}, reportTrees: {} };

    const siteIds = Subquery.select(Site, "id").in(
      "uuid",
      sitePolygons.map(({ siteUuid }) => siteUuid)
    ).literal;
    const siteReportIds = Subquery.select(SiteReport, "id").in("siteId", siteIds).literal;
    const trees = await TreeSpecies.visible()
      .collection("tree-planted")
      .findAll({
        where: {
          [Op.or]: [
            {
              speciesableType: Site.LARAVEL_TYPE,
              speciesableId: { [Op.in]: siteIds }
            },
            {
              speciesableType: SiteReport.LARAVEL_TYPE,
              speciesableId: { [Op.in]: siteReportIds }
            }
          ]
        },
        attributes: ["speciesableType", "speciesableId", "name", "amount"]
      });
    const siteTrees = groupBy(
      trees.filter(({ speciesableType }) => speciesableType === Site.LARAVEL_TYPE),
      "speciesableId"
    ) as Record<number, TreeSpecies[]>;
    const reportTrees = groupBy(
      trees.filter(({ speciesableType }) => speciesableType === SiteReport.LARAVEL_TYPE),
      "speciesableId"
    ) as Record<number, TreeSpecies[]>;
    return { siteTrees, reportTrees };
  }

  /**
   * Get a mapping of site id to a list of site reports. Only id, siteId, dueAt and submittedAt are loaded
   * on the resulting reports.
   */
  private async getSiteReports(sitePolygons: SitePolygon[]) {
    if (sitePolygons.length === 0) return {};

    const siteIds = Subquery.select(Site, "id").in(
      "uuid",
      sitePolygons.map(({ siteUuid }) => siteUuid)
    ).literal;
    return groupBy(
      await SiteReport.findAll({
        where: { siteId: { [Op.in]: siteIds } },
        attributes: ["id", "siteId", "dueAt", "submittedAt"]
      }),
      "siteId"
    ) as Record<number, SiteReport[]>;
  }
}
