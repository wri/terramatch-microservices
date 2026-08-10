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
import { Attributes, Op, QueryTypes, Transaction } from "sequelize";
import { SiteIndicatorRollupRow } from "./dto/site-indicator-rollup.dto";
import { CursorPage, isCursorPage, isNumberPage, NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import {
  INDICATOR_SLUGS,
  PolygonStatus,
  POLYGON_DRAFT,
  POLYGON_PENDING_APPROVAL,
  VALIDATION_TYPES,
  AuditStatusType
} from "@terramatch-microservices/database/constants";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { SitePolygonStatusUpdate } from "./dto/site-polygon-status-update.dto";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";

// Earliest year present in indicator_output_tree_cover_loss.value maps. The span is walked
// explicitly because the per-year keys cannot be enumerated in SQL without JSON_TABLE.
const TREE_COVER_LOSS_FIRST_YEAR = 2000;

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

  async buildQuery(page: CursorPage | NumberPage, options?: { includeGeometry?: boolean }) {
    const builder = new SitePolygonQueryBuilder(page.size, options);
    if ((page as CursorPage).after != null && (page as NumberPage).number != null) {
      throw new BadRequestException("page[after] or page[number] may be provided, but not both.");
    }

    if (isNumberPage(page) && page.number != null) builder.pageNumber(page.number);
    else if (isCursorPage(page) && page.after != null) await builder.pageAfter(page.after);
    return builder;
  }

  buildDeletedQuery(page: NumberPage): SitePolygonQueryBuilder {
    const builder = new SitePolygonQueryBuilder(page.size, { includeGeometry: false })
      .includeSoftDeleted()
      .filterSoftDeletedOnly()
      .order([["deletedAt", "DESC"]]);
    if (page.number != null) builder.pageNumber(page.number);
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
    if (sitePolygons.length === 0) return associationDtos;

    if (lightResource) {
      for (const [sitePolygonId, indicators] of Object.entries(await this.getIndicators(sitePolygons))) {
        associationDtos[Number(sitePolygonId)] = { indicators };
      }
      return associationDtos;
    }

    const [indicatorsMap, sites] = await Promise.all([this.getIndicators(sitePolygons), this.getSites(sitePolygons)]);

    for (const [sitePolygonId, indicators] of Object.entries(indicatorsMap)) {
      associationDtos[Number(sitePolygonId)] = { indicators };
    }

    const siteIds = uniq(Object.values(sites));
    const [reports, { siteTrees, reportTrees }] = await Promise.all([
      this.getSiteReportsBySiteIds(siteIds),
      this.getTreeSpeciesBySiteIds(siteIds)
    ]);

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
    const plantStartById = new Map(sitePolygons.map(sp => [sp.id, sp.plantStart]));
    const modelClasses = uniq(Object.values(INDICATOR_MODEL_CLASSES));

    const indicatorBatches = await Promise.all(
      modelClasses.map(modelClass => modelClass.findAll({ where: { sitePolygonId: { [Op.in]: sitePolygonIds } } }))
    );

    for (const indicators of indicatorBatches) {
      let fields: string[] | undefined = undefined;
      for (const indicator of indicators) {
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
          const plantStart = plantStartById.get(indicator.sitePolygonId);
          if (plantStart != null) {
            const plantStartYear = new Date(plantStart).getFullYear();
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
   * between the two to correctly deal with the aggregate data from getTreeSpeciesBySiteIds() and
   * getSiteReportsBySiteIds().
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
  private async getTreeSpeciesBySiteIds(siteIds: number[]) {
    if (siteIds.length === 0) return { siteTrees: {}, reportTrees: {} };

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
  private async getSiteReportsBySiteIds(siteIds: number[]) {
    if (siteIds.length === 0) return {};

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

    if (status === POLYGON_PENDING_APPROVAL && user != null) {
      const polygonUuids = sitePolygons
        .map(sp => sp.polygonUuid)
        .filter((uuid): uuid is string => uuid != null && uuid !== "");
      if (polygonUuids.length > 0) {
        const siteUuid = sitePolygons[0]?.siteUuid ?? undefined;
        this.enqueuePolygonValidation(polygonUuids, user.id, {
          siteUuid,
          triggerType: POLYGON_PENDING_APPROVAL
        }).catch(err => this.logger.error("Failed to enqueue automated polygon validation on submit", err));
      }
    }

    return sitePolygons;
  }

  async enqueuePolygonValidation(
    rawPolygonUuids: string[],
    userId: number,
    options: { siteUuid?: string; triggerType: "pending-approval" | "gh_push" | "upload" }
  ): Promise<void> {
    const polygonUuids = [...new Set(rawPolygonUuids.filter(uuid => uuid.length > 0))];
    if (polygonUuids.length === 0) return;

    const { siteUuid, triggerType } = options;

    let siteName: string | null = null;
    if (siteUuid != null) {
      const site = await Site.findOne({ where: { uuid: siteUuid }, attributes: ["id", "name"] });
      siteName = site?.name ?? siteUuid;
    }

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Validation",
      totalContent: polygonUuids.length,
      processedContent: 0,
      progressMessage: "Queued for automated validation...",
      createdBy: userId,
      metadata: {
        entity_id: null,
        entity_type: Site.LARAVEL_TYPE,
        entity_name: siteName,
        trigger_type: triggerType
      } as Record<string, unknown>
    } as unknown as DelayedJob);

    await this.validationQueue.add("polygonValidation", {
      polygonUuids,
      validationTypes: [...VALIDATION_TYPES],
      delayedJobId: delayedJob.id,
      siteUuid,
      triggerType
    });

    this.logger.log(
      `Queued automated polygon validation for ${polygonUuids.length} polygons (trigger: ${triggerType}, delayedJobId: ${delayedJob.id})`
    );
  }

  async promoteEligibleGhPolygons(rawPolygonUuids: string[]): Promise<number> {
    const polygonUuids = [...new Set(rawPolygonUuids.filter(uuid => uuid.length > 0))];
    if (polygonUuids.length === 0) return 0;

    const sitePolygons = await SitePolygon.findAll({
      where: {
        polygonUuid: { [Op.in]: polygonUuids },
        isActive: true,
        status: POLYGON_DRAFT,
        validationStatus: { [Op.in]: ["passed", "partial"] }
      }
    });
    if (sitePolygons.length === 0) return 0;

    const userId = UserContext.authenticatedUserId;
    const user =
      userId == null
        ? null
        : await User.findByPk(userId, { attributes: ["id", "emailAddress", "firstName", "lastName"] });

    await SitePolygon.update(
      { status: POLYGON_PENDING_APPROVAL },
      { where: { id: { [Op.in]: sitePolygons.map(sp => sp.id) } } }
    );

    const auditStatusRecords = this.createAuditStatusRecords(
      sitePolygons,
      POLYGON_PENDING_APPROVAL,
      "Automatically submitted after GreenHouse push validation",
      user
    ) as Array<Attributes<AuditStatus>>;
    if (auditStatusRecords.length > 0) {
      await AuditStatus.bulkCreate(auditStatusRecords);
    }

    this.logger.log(`Promoted ${sitePolygons.length} GH polygons to pending-approval after validation`);
    return sitePolygons.length;
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
    const auditStatusTypes = ["status", "comment"];
    return auditStatusTypes.flatMap(type => {
      if (type === "comment" && comment === null) {
        return [];
      }
      return sitePolygons.map(sitePolygon => ({
        auditableType: SitePolygon.LARAVEL_TYPE,
        auditableId: sitePolygon.id,
        createdBy: user?.emailAddress ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        comment: comment ?? null,
        status: status as PolygonStatus,
        type: type as AuditStatusType,
        isActive: null
      }));
    });
  }

  /**
   * Per-site indicator rollup for a project, in a single GROUP BY: O(sites), not O(polygons).
   * The client-side path pages every polygon in the project, which is untenable for large
   * projects (one site in project 448 holds 7,293 polygons).
   *
   * Measurements cover active, APPROVED polygons only — the basis the rest of TerraMatch reports
   * on. dashboard-projects.service.ts computes totalHectaresRestoredSum as .active().approved(),
   * and the two agree to the last decimal. Non-approved active polygons are counted separately
   * as inReviewCount so their exclusion is visible rather than silent.
   *
   * The status predicate lives in the aggregates, not the JOIN, so that a site whose polygons are
   * all unapproved still returns a row with null measurements. Dropping the row would assert the
   * site does not exist, which is a stronger and falser claim than "not measured yet".
   *
   * deleted_at is not filtered in the latest-year CTEs, matching the validated spike. Adding the
   * filter changes which row ranks as latest and lowers coverage.
   */
  async getIndicatorRollup(projectUuid: string) {
    // indicator_output_tree_cover_loss.value is a per-year map, {"2011": 3.53, ...}, so the total
    // for a polygon is the sum across years. MariaDB 10.3 has no JSON_TABLE (added in 10.6) and
    // the SEQUENCE engine is MariaDB-only, so the year span is joined as a generated derived
    // table, which is portable to both MariaDB and MySQL 8.
    const years = [];
    for (let year = TREE_COVER_LOSS_FIRST_YEAR; year <= new Date().getFullYear() + 1; year++) {
      years.push(year);
    }
    const yearsUnion = years.map(year => `SELECT ${year} AS y`).join(" UNION ALL ");

    const query = `
      WITH tc AS (
        SELECT
          site_polygon_id,
          percent_cover,
          ROW_NUMBER() OVER (
            PARTITION BY site_polygon_id
            ORDER BY year_of_analysis DESC, id DESC
          ) AS rn
        FROM indicator_output_tree_cover
      ),
      tcl_latest AS (
        SELECT
          site_polygon_id,
          value,
          ROW_NUMBER() OVER (
            PARTITION BY site_polygon_id
            ORDER BY year_of_analysis DESC, id DESC
          ) AS rn
        FROM indicator_output_tree_cover_loss
        WHERE indicator_slug = 'treeCoverLoss'
      ),
      years AS (${yearsUnion}),
      tcl AS (
        SELECT
          t.site_polygon_id,
          SUM(CAST(COALESCE(JSON_VALUE(t.value, CONCAT('$."', y.y, '"')), 0) AS DECIMAL(24,8))) AS lossTotal
        FROM tcl_latest t
        CROSS JOIN years y
        WHERE t.rn = 1
        GROUP BY t.site_polygon_id
      )
      SELECT
        s.uuid AS siteUuid,
        s.name AS siteName,
        SUM(CASE WHEN sp.status <> 'approved' THEN 1 ELSE 0 END) AS inReviewCount,
        SUM(CASE WHEN sp.status = 'approved' THEN 1 ELSE 0 END) AS polygons,
        SUM(CASE WHEN sp.status = 'approved' THEN sp.calc_area END) AS hectares,
        SUM(CASE WHEN sp.status = 'approved' THEN tc.percent_cover * NULLIF(sp.calc_area, 0) END)
          / NULLIF(SUM(CASE WHEN sp.status = 'approved' AND tc.percent_cover IS NOT NULL
                            THEN NULLIF(sp.calc_area, 0) END), 0)
          AS treeCoverWeightedMeanPct,
        SUM(CASE WHEN sp.status = 'approved' AND tc.site_polygon_id IS NOT NULL THEN 1 ELSE 0 END)
          AS treeCoverPolygonCount,
        SUM(CASE WHEN sp.status = 'approved' THEN tcl.lossTotal END) AS treeCoverLossTotal,
        SUM(CASE WHEN sp.status = 'approved' AND tcl.site_polygon_id IS NOT NULL THEN 1 ELSE 0 END)
          AS treeCoverLossPolygonCount
      FROM v2_projects p
      JOIN v2_sites s
        ON s.project_id = p.id
       AND s.deleted_at IS NULL
       AND s.status = 'approved'
      JOIN site_polygon sp
        ON sp.site_id = s.uuid
       AND sp.is_active = 1
      LEFT JOIN tc
        ON tc.site_polygon_id = sp.id
       AND tc.rn = 1
      LEFT JOIN tcl
        ON tcl.site_polygon_id = sp.id
      WHERE p.uuid = :projectUuid
        AND p.deleted_at IS NULL
      GROUP BY s.uuid, s.name
      ORDER BY s.name
    `;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return (await SitePolygon.sequelize!.query(query, {
      replacements: { projectUuid },
      type: QueryTypes.SELECT
    })) as SiteIndicatorRollupRow[];
  }
}
