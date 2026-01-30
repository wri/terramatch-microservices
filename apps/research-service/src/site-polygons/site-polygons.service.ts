import { BadRequestException, Injectable, NotFoundException, Type } from "@nestjs/common";
import {
  AuditStatus,
  CriteriaSite,
  CriteriaSiteHistoric,
  PointGeometry,
  PolygonGeometry,
  ProjectPolygon,
  Site,
  SitePolygon,
  SitePolygonData,
  SiteReport,
  TreeSpecies,
  User,
  Project,
  DelayedJob
} from "@terramatch-microservices/database/entities";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
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
import { Attributes, Op, Transaction } from "sequelize";
import { CursorPage, isCursorPage, isNumberPage, NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { INDICATOR_SLUGS, PolygonStatus } from "@terramatch-microservices/database/constants";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { SitePolygonStatusUpdate } from "./dto/site-polygon-status-update.dto";

type AssociationDtos = {
  indicators?: IndicatorDto[];
  establishmentTreeSpecies?: TreeSpeciesDto[];
  reportingPeriods?: ReportingPeriodDto[];
};

@Injectable()
export class SitePolygonsService {
  private readonly logger = new TMLogger(SitePolygonsService.name);

  constructor(
    private readonly polygonGeometryService: PolygonGeometryCreationService,
    @InjectQueue("validation") private readonly validationQueue: Queue
  ) {}

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

  private async deleteSitePolygonRelatedRecords(
    sitePolygonIds: number[],
    sitePolygonUuids: string[],
    polygonUuids: string[],
    pointUuids: string[],
    primaryUuids: string[],
    transaction: Transaction
  ): Promise<void> {
    for (const IndicatorClass of Object.values(INDICATOR_MODEL_CLASSES)) {
      await IndicatorClass.destroy({
        where: { sitePolygonId: { [Op.in]: sitePolygonIds } },
        transaction
      });
    }

    if (polygonUuids.length > 0) {
      await CriteriaSite.destroy({
        where: { polygonId: { [Op.in]: polygonUuids } },
        transaction
      });
      await CriteriaSiteHistoric.destroy({
        where: { polygonId: { [Op.in]: polygonUuids } },
        transaction
      });
    }

    await SitePolygonData.destroy({
      where: { sitePolygonUuid: { [Op.in]: sitePolygonUuids } },
      transaction
    });

    await AuditStatus.destroy({
      where: {
        auditableType: SitePolygon.LARAVEL_TYPE,
        auditableId: { [Op.in]: sitePolygonIds }
      },
      transaction
    });

    if (polygonUuids.length > 0) {
      await ProjectPolygon.destroy({
        where: { polyUuid: { [Op.in]: polygonUuids } },
        transaction
      });
    }

    if (pointUuids.length > 0) {
      await PointGeometry.destroy({
        where: { uuid: { [Op.in]: pointUuids } },
        transaction
      });
    }

    if (polygonUuids.length > 0) {
      await PolygonGeometry.destroy({
        where: { uuid: { [Op.in]: polygonUuids } },
        transaction
      });
    }

    await SitePolygon.destroy({
      where: { primaryUuid: { [Op.in]: primaryUuids } },
      transaction
    });
    if (polygonUuids.length > 0) {
      await this.polygonGeometryService.bulkUpdateProjectCentroids(polygonUuids, transaction);
    }
  }

  async bulkDeleteSitePolygons(sitePolygons: SitePolygon[]): Promise<string[]> {
    if (sitePolygons.length === 0) {
      return [];
    }

    return await this.transaction(async transaction => {
      const uniquePrimaryUuids = uniq(sitePolygons.map(sp => sp.primaryUuid).filter(isNotNull));

      const allRelatedSitePolygons = await SitePolygon.findAll({
        where: { primaryUuid: { [Op.in]: uniquePrimaryUuids } },
        attributes: ["id", "uuid", "polygonUuid", "pointUuid"],
        transaction
      });

      const allSitePolygonIds = allRelatedSitePolygons.map(sp => sp.id);
      const allSitePolygonUuids = allRelatedSitePolygons.map(sp => sp.uuid);
      const allPolygonUuids = allRelatedSitePolygons.map(sp => sp.polygonUuid).filter(isNotNull);
      const allPointUuids = allRelatedSitePolygons.map(sp => sp.pointUuid).filter(isNotNull);

      await this.deleteSitePolygonRelatedRecords(
        allSitePolygonIds,
        allSitePolygonUuids,
        allPolygonUuids,
        allPointUuids,
        uniquePrimaryUuids,
        transaction
      );

      return allSitePolygonUuids;
    });
  }

  async deleteSitePolygon(uuid: string): Promise<void> {
    await this.transaction(async transaction => {
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

      const relatedSitePolygons = await SitePolygon.findAll({
        where: { primaryUuid: sitePolygon.primaryUuid },
        attributes: ["id", "uuid", "polygonUuid", "pointUuid"],
        transaction
      });

      const sitePolygonIds = relatedSitePolygons.map(sp => sp.id);
      const sitePolygonUuids = relatedSitePolygons.map(sp => sp.uuid);
      const polygonUuids = relatedSitePolygons.map(sp => sp.polygonUuid).filter((uuid): uuid is string => uuid != null);
      const pointUuids = relatedSitePolygons.map(sp => sp.pointUuid).filter((uuid): uuid is string => uuid != null);
      const primaryUuid = sitePolygon.primaryUuid;

      await this.deleteSitePolygonRelatedRecords(
        sitePolygonIds,
        sitePolygonUuids,
        polygonUuids,
        pointUuids,
        [primaryUuid],
        transaction
      );
    });
  }

  async deleteSingleVersion(uuid: string): Promise<void> {
    await this.transaction(async transaction => {
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

      const allVersions = await SitePolygon.findAll({
        where: { primaryUuid: sitePolygon.primaryUuid },
        attributes: ["id", "uuid", "isActive", "polygonUuid", "pointUuid"],
        transaction
      });

      if (allVersions.length === 1) {
        throw new BadRequestException(
          "Cannot delete the last version. Use DELETE without /version to delete all versions."
        );
      }

      if (sitePolygon.isActive) {
        throw new BadRequestException("Cannot delete the active version. Please activate another version first.");
      }

      const polygonUuid = sitePolygon.polygonUuid;
      const pointUuid = sitePolygon.pointUuid;

      for (const IndicatorClass of Object.values(INDICATOR_MODEL_CLASSES)) {
        await IndicatorClass.destroy({
          where: { sitePolygonId: sitePolygon.id },
          transaction
        });
      }

      if (polygonUuid != null) {
        await CriteriaSite.destroy({
          where: { polygonId: polygonUuid },
          transaction
        });
        await CriteriaSiteHistoric.destroy({
          where: { polygonId: polygonUuid },
          transaction
        });
      }

      await SitePolygonData.destroy({
        where: { sitePolygonUuid: uuid },
        transaction
      });

      await AuditStatus.destroy({
        where: {
          auditableType: SitePolygon.LARAVEL_TYPE,
          auditableId: sitePolygon.id
        },
        transaction
      });

      if (polygonUuid != null) {
        await ProjectPolygon.destroy({
          where: { polyUuid: polygonUuid },
          transaction
        });
      }

      if (polygonUuid != null) {
        const otherVersionsUsingGeometry = allVersions.filter(v => v.uuid !== uuid && v.polygonUuid === polygonUuid);

        if (otherVersionsUsingGeometry.length === 0) {
          await PolygonGeometry.destroy({
            where: { uuid: polygonUuid },
            transaction
          });
        }
      }

      if (pointUuid != null) {
        const otherVersionsUsingPoint = allVersions.filter(v => v.uuid !== uuid && v.pointUuid === pointUuid);

        if (otherVersionsUsingPoint.length === 0) {
          await PointGeometry.destroy({
            where: { uuid: pointUuid },
            transaction
          });
        }
      }

      await SitePolygon.destroy({
        where: { uuid },
        transaction
      });

      if (polygonUuid != null) {
        await this.polygonGeometryService.bulkUpdateProjectCentroids([polygonUuid], transaction);
      }
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

  async updateBulkStatus(
    status: PolygonStatus,
    sitePolygonsUpdate: SitePolygonStatusUpdate[],
    comment: string | null | undefined,
    user: User | null
  ) {
    await SitePolygon.update({ status }, { where: { uuid: { [Op.in]: sitePolygonsUpdate.map(d => d.id) } } });
    const sitePolygons = await SitePolygon.findAll({ where: { uuid: { [Op.in]: sitePolygonsUpdate.map(d => d.id) } } });

    const auditStatusRecords = this.createAuditStatusRecords(sitePolygons, status, comment, user) as Array<
      Attributes<AuditStatus>
    >;
    if (auditStatusRecords.length > 0) {
      await AuditStatus.bulkCreate(auditStatusRecords);
    }

    if (status === "approved" && user != null) {
      await this.triggerProjectValidationJobs(sitePolygons, user.id);
    }

    return sitePolygons;
  }

  async triggerProjectValidationJobs(sitePolygons: SitePolygon[], userId: number): Promise<void> {
    const siteUuids = [
      ...new Set(sitePolygons.map(sp => sp.siteUuid).filter((uuid): uuid is string => uuid != null && uuid !== ""))
    ];
    if (siteUuids.length === 0) {
      return;
    }

    const sites = await Site.findAll({
      where: { uuid: { [Op.in]: siteUuids } },
      attributes: ["id", "projectId", "name"]
    });

    const projectIds = [...new Set(sites.map(s => s.projectId).filter((id): id is number => id != null))];
    if (projectIds.length === 0) {
      return;
    }

    for (const projectId of projectIds) {
      try {
        const project = await Project.findByPk(projectId, { attributes: ["id", "name"] });
        if (project === null) {
          this.logger.warn(`Project with ID ${projectId} not found, skipping validation job creation`);
          continue;
        }

        const delayedJob = await DelayedJob.create({
          isAcknowledged: false,
          name: "Project Area Validation Refresh",
          totalContent: 0,
          processedContent: 0,
          progressMessage: "Starting project-wide validation...",
          createdBy: userId,
          metadata: {
            entity_id: project.id,
            entity_type: Project.LARAVEL_TYPE,
            entity_name: project.name ?? null
          }
        } as DelayedJob);

        await this.validationQueue.add("projectValidation", {
          projectId,
          validationTypes: ["ESTIMATED_AREA"],
          delayedJobId: delayedJob.id
        });

        this.logger.log(`Queued project area validation refresh for project ${projectId} (job ${delayedJob.id})`);
      } catch (error) {
        this.logger.error(
          `Failed to queue project area validation refresh for project ${projectId}`,
          error instanceof Error ? error.stack : String(error)
        );
      }
    }
  }

  private createAuditStatusRecords(
    sitePolygons: SitePolygon[],
    status: PolygonStatus,
    comment: string | null | undefined,
    user: User | null
  ): Array<Partial<AuditStatus>> {
    return sitePolygons.map(sitePolygon => ({
      auditableType: SitePolygon.LARAVEL_TYPE,
      auditableId: sitePolygon.id,
      createdBy: user?.emailAddress ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      comment: comment ?? null,
      status: status as PolygonStatus,
      type: "status",
      isActive: null
    }));
  }
}
