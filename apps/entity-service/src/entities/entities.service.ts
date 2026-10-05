import { BadRequestException, Injectable } from "@nestjs/common";
import { ProjectProcessor, SiteProcessor } from "./processors";
import { Model, ModelCtor } from "sequelize-typescript";
import { EntityProcessor, ExportAllOptions } from "./processors/entity-processor";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import {
  Disturbance,
  Form,
  FormQuestion,
  Invasive,
  Media,
  Project,
  ProjectUser,
  Seeding,
  Strata,
  Tracking,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { MediaCollection } from "@terramatch-microservices/database/types/media";
import { chunk, Dictionary, groupBy, kebabCase, omit, orderBy, sum, uniq, uniqBy } from "lodash";
import { col, fn, Includeable, Op } from "sequelize";
import { EntityDto } from "./dto/entity.dto";
import { AssociationProcessor } from "./processors/association-processor";
import { AssociationDto, AssociationDtoAdditionalProps } from "@terramatch-microservices/common/dto/association.dto";
import { NurseryProcessor } from "./processors/nursery.processor";
import {
  ENTITY_MODELS,
  EntityModel,
  EntityType,
  isLinkedEntityModel
} from "@terramatch-microservices/database/constants/entities";
import { ProjectReportProcessor } from "./processors/project-report.processor";
import { NurseryReportProcessor } from "./processors/nursery-report.processor";
import { SiteReportProcessor } from "./processors/site-report.processor";
import { FinancialReportProcessor } from "./processors/financial-report.processor";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { SeedingDto } from "@terramatch-microservices/common/dto/seeding.dto";
import { TreeSpeciesDto } from "@terramatch-microservices/common/dto/tree-species.dto";
import { TrackingDto } from "@terramatch-microservices/common/dto/tracking.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaProcessor } from "./processors/media.processor";
import { EntityUpdateData } from "./dto/entity-update.dto";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ITranslateParams } from "@transifex/native";
import { MediaQueryDto } from "./dto/media-query.dto";
import { DisturbanceDto } from "@terramatch-microservices/common/dto/disturbance.dto";
import { InvasiveDto } from "@terramatch-microservices/common/dto/invasive.dto";
import { StrataDto } from "@terramatch-microservices/common/dto/strata.dto";
import {
  MEDIA_OWNER_MODELS,
  MediaOwnerModel,
  MediaOwnerType
} from "@terramatch-microservices/database/constants/media-owners";
import { MediaOwnerProcessor } from "./processors/media-owner-processor";
import { DisturbanceReportProcessor } from "./processors/disturbance-report.processor";
import { EntityCreateData } from "./dto/entity-create.dto";
import { SrpReportProcessor } from "./processors/srp-report.processor";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { isField, isPropertyField } from "@terramatch-microservices/database/constants/linked-fields";
import { ConfigService } from "@nestjs/config";
import { LinkedAnswerCollector } from "@terramatch-microservices/common/linkedFields/linkedAnswerCollector";
import {
  CsvExportService,
  getAttributes,
  getFormQuestionsForExport,
  getMappingsColumns
} from "@terramatch-microservices/common/export/csv-export.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { Archiver } from "archiver";
import { Literal } from "sequelize/types/utils";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { DateTime } from "luxon";
import { REPORT_COUNT_TYPES, ReportCountsQueryDto, ReportCountType } from "./dto/report-counts-query.dto";
import { ReportingPeriodDto } from "./dto/report-counts.dto";
import { filteredReportsSubquery, REPORT_FILTER_MODELS, ReportFilter } from "./report-filters";
import { ReportStatus } from "@terramatch-microservices/database/constants/status";

// The keys of this array must match the type in the resulting DTO.
export const ENTITY_PROCESSORS = {
  projects: ProjectProcessor,
  sites: SiteProcessor,
  nurseries: NurseryProcessor,
  projectReports: ProjectReportProcessor,
  nurseryReports: NurseryReportProcessor,
  siteReports: SiteReportProcessor,
  financialReports: FinancialReportProcessor,
  disturbanceReports: DisturbanceReportProcessor,
  srpReports: SrpReportProcessor
} as const;

export type ProcessableEntity = keyof typeof ENTITY_PROCESSORS;
export const PROCESSABLE_ENTITIES = Object.keys(ENTITY_PROCESSORS) as ProcessableEntity[];
export const POLYGON_STATUSES_FILTERS = [
  "no-polygons",
  "pending-approval",
  "approved",
  "information-required",
  "draft"
] as const;

export type PolygonStatusFilter = (typeof POLYGON_STATUSES_FILTERS)[number];

export type ProgressTick = (progressCount?: number) => Promise<void>;

const ASSOCIATION_PROCESSORS = {
  trackings: AssociationProcessor.buildSimpleProcessor(TrackingDto, ({ id: trackableId }, trackableType) =>
    Tracking.findAll({
      where: { trackableType, trackableId, hidden: false },
      include: [{ association: "entries" }]
    })
  ),
  seedings: AssociationProcessor.buildSimpleProcessor(SeedingDto, ({ id: seedableId }, seedableType) =>
    Seeding.findAll({ where: { seedableType, seedableId, hidden: false } })
  ),
  treeSpecies: AssociationProcessor.buildSimpleProcessor(TreeSpeciesDto, ({ id: speciesableId }, speciesableType) =>
    TreeSpecies.findAll({
      where: { speciesableType, speciesableId, hidden: false },
      raw: true,
      attributes: ["uuid", "name", "taxonId", "collection", [fn("SUM", col("amount")), "amount"]],
      group: ["taxonId", "name", "collection"]
    })
  ),
  media: MediaProcessor,
  disturbances: AssociationProcessor.buildSimpleProcessor(
    DisturbanceDto,
    ({ id: disturbanceableId }, disturbanceableType) =>
      Disturbance.findAll({ where: { disturbanceableType, disturbanceableId, hidden: false } })
  ),
  invasives: AssociationProcessor.buildSimpleProcessor(InvasiveDto, ({ id: invasiveableId }, invasiveableType) =>
    Invasive.findAll({ where: { invasiveableType, invasiveableId, hidden: false } })
  ),
  stratas: AssociationProcessor.buildSimpleProcessor(StrataDto, ({ id: stratasableId }, stratasableType) =>
    Strata.findAll({ where: { stratasableType, stratasableId, hidden: false } })
  )
};

export type ProcessableAssociation = keyof typeof ASSOCIATION_PROCESSORS;
export const PROCESSABLE_ASSOCIATIONS = Object.keys(ASSOCIATION_PROCESSORS) as ProcessableAssociation[];

const DUE_DATE_FILTERS = ["dueDateFrom", "dueDateTo", "dueMonth", "dueYear"] as const;

const reportCountTypes = (reportTypes?: ReportCountType[]) =>
  reportTypes != null && reportTypes.length > 0 ? uniq(reportTypes) : REPORT_COUNT_TYPES;

/**
 * Returns a subquery of the project ids that reports should be limited to, or undefined if no
 * project limitation is required.
 */
const scopedProjectIds = (userProjectIds?: Literal, projectUuid?: string) => {
  if (userProjectIds == null && projectUuid == null) return undefined;

  const builder = Subquery.select(Project, "id");
  if (userProjectIds != null) builder.in("id", userProjectIds);
  if (projectUuid != null) builder.eq("uuid", projectUuid);
  return builder.literal;
};

type EntityFrameworkExportOptions<T extends EntityModel> = Omit<ExportAllOptions, "frameworkKey" | "projectUuid"> & {
  // If not specified, all attributes will be fetched from the DB when using a query builder.
  attributes?: string[];

  frameworkKey?: FrameworkKey;

  /**
   * If provided, is expected to provide additional data for the CSV mapping for the given page
   * keyed on entity id.
   */
  additionalDataForPage?: (page: T[]) => Promise<Record<number, Dictionary<unknown>>>;

  /**
   * If provided, each record to be exported will be checked with the given ability.
   */
  ability?: string;

  /**
   * If not provided, a filename will be generated based on the framework key and entity type.
   */
  fileName?: string;
};

@Injectable()
export class EntitiesService {
  protected logger = new TMLogger(EntitiesService.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly policyService: PolicyService,
    private readonly localizationService: LocalizationService,
    private readonly configService: ConfigService,
    private readonly csvExportService: CsvExportService
  ) {}

  get userId() {
    return this.policyService.userId;
  }

  get isProd() {
    return this.configService.get<string>("DEPLOY_ENV") === "prod";
  }

  get permissions() {
    return this.userId == null ? undefined : this.policyService.permissions;
  }

  async authorize(action: string, subject: Model | Model[]) {
    await this.policyService.authorize(action, subject);
  }

  async countReports(query: ReportCountsQueryDto) {
    const filter = this.reportFilter(query);
    if (filter == null) return 0;

    const counts = await Promise.all(
      reportCountTypes(query.reportTypes).map(type =>
        REPORT_FILTER_MODELS[type].model.count({
          where: { id: { [Op.in]: filteredReportsSubquery(type, "id", filter).literal } }
        })
      )
    );
    return sum(counts);
  }

  /**
   * Returns the distinct due month / year of reports matching the query, newest first. The due date
   * filters are ignored so that the result can be used to offer the available periods to select.
   */
  async reportingPeriods(query: ReportCountsQueryDto): Promise<ReportingPeriodDto[]> {
    const filter = this.reportFilter(omit(query, DUE_DATE_FILTERS));
    if (filter == null) return [];

    const periods = await Promise.all(
      reportCountTypes(query.reportTypes).map(
        async type =>
          (await REPORT_FILTER_MODELS[type].model.findAll({
            where: {
              id: { [Op.in]: filteredReportsSubquery(type, "id", filter).literal },
              dueAt: { [Op.ne]: null }
            },
            attributes: [
              [fn("YEAR", col("due_at")), "dueYear"],
              [fn("MONTH", col("due_at")), "dueMonth"]
            ],
            group: ["dueYear", "dueMonth"],
            raw: true
          })) as unknown as ReportingPeriodDto[]
      )
    );

    const unique = uniqBy(
      periods.flat().map(({ dueYear, dueMonth }) => ({ dueYear: Number(dueYear), dueMonth: Number(dueMonth) })),
      ({ dueYear, dueMonth }) => `${dueYear}-${dueMonth}`
    );
    return orderBy(unique, ["dueYear", "dueMonth"], ["desc", "desc"]);
  }

  /**
   * Builds a report filter from the query for the current user, applying the same read scoping as
   * the report processors' findMany implementations. Returns undefined if the user has no access to
   * any reports.
   */
  reportFilter(
    { dueDateFrom, dueDateTo, dueMonth, dueYear, statuses, search, projectUuid }: ReportCountsQueryDto,
    defaultStatuses?: readonly ReportStatus[]
  ): ReportFilter | undefined {
    const frameworkKeys = (this.permissions ?? [])
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length));
    const isFrameworkAdmin = frameworkKeys.length > 0;
    const userProjectIds = isFrameworkAdmin ? undefined : this.userProjectIdsSubquery();
    if (!isFrameworkAdmin && userProjectIds == null) return undefined;

    return {
      frameworkKeys,
      projectIds: scopedProjectIds(userProjectIds, projectUuid),
      statuses: statuses != null && statuses.length > 0 ? statuses : defaultStatuses,
      dueDateFrom: dueDateFrom == null ? undefined : DateTime.fromISO(dueDateFrom, { zone: "utc" }).toJSDate(),
      dueDateTo: dueDateTo == null ? undefined : DateTime.fromISO(dueDateTo, { zone: "utc" }).toJSDate(),
      dueMonth,
      dueYear,
      search
    };
  }

  /**
   * Returns a subquery of the ids of projects the user has access to via manage-own or
   * projects-manage, or undefined if they have neither permission. Mirrors the read scoping in the
   * report processors' findMany implementations.
   */
  private userProjectIdsSubquery() {
    const permissions = this.permissions ?? [];
    const userId = this.userId as number;
    if (permissions.includes("manage-own")) return ProjectUser.userProjectsSubquery(userId);
    if (permissions.includes("projects-manage")) return ProjectUser.projectsManageSubquery(userId);
    return undefined;
  }

  async isFrameworkAdmin<T extends EntityModel>({ frameworkKey }: T) {
    const permissions = this.permissions;
    return permissions == null ? false : permissions.includes(`framework-${frameworkKey}`);
  }

  /**
   * A utility to hide values that will eventually be removed in the FieldsApprovalProcessor when
   * the entity is approved.
   *
   * NOOPs quickly if the entity is already in an approved state.
   */
  async removeHiddenValues(entity: EntityModel, dto: EntityDto) {
    const { answers, status } = entity;
    if (answers == null || status === "approved") return;

    const form = await Form.for(entity).findOne({ attributes: ["uuid"] });
    const questions = form == null ? [] : await FormQuestion.forForm(form.uuid).findAll();
    if (questions.length == 0) return;

    await Promise.all(
      questions.map(async question => {
        if (question.linkedFieldKey == null || !question.isHidden(answers, questions)) return;

        const field = getLinkedFieldConfig(question.linkedFieldKey)?.field;
        if (field == null || !isField(field) || !isPropertyField(field)) return;

        if (field.property in dto) delete dto[field.property as keyof typeof dto];
      })
    );
  }

  get userLocale() {
    return UserContext.userLocale ?? "en-US";
  }

  async localizeText(text: string, params?: ITranslateParams) {
    return await this.localizationService.localizeText(text, this.userLocale, params);
  }

  createEntityProcessor<T extends EntityModel>(entity: ProcessableEntity) {
    const processorClass = ENTITY_PROCESSORS[entity];
    if (processorClass == null) {
      throw new BadRequestException(`Entity type invalid: ${entity}`);
    }

    return new processorClass(this, entity) as unknown as EntityProcessor<
      T,
      EntityDto,
      EntityDto,
      EntityUpdateData,
      EntityCreateData
    >;
  }

  createAssociationProcessor<T extends UuidModel, D extends AssociationDto>(
    entityType: EntityType,
    uuid: string,
    association: ProcessableAssociation,
    query?: MediaQueryDto
  ) {
    const processorClass = ASSOCIATION_PROCESSORS[association];
    if (processorClass == null) {
      throw new BadRequestException(`Association type invalid: ${entityType}`);
    }

    const entityModelClass = ENTITY_MODELS[entityType];
    if (entityModelClass == null) {
      throw new BadRequestException(`Entity type invalid: ${entityType}`);
    }

    return new processorClass(entityType, uuid, entityModelClass, this, query) as unknown as AssociationProcessor<T, D>;
  }

  createMediaOwnerProcessor(mediaOwnerType: MediaOwnerType, mediaOwnerUuid: string) {
    const mediaOwnerModelClass = MEDIA_OWNER_MODELS[mediaOwnerType];
    if (mediaOwnerModelClass == null) {
      throw new BadRequestException(`Media owner type invalid: ${mediaOwnerType}`);
    }
    return new MediaOwnerProcessor(mediaOwnerType, mediaOwnerUuid, mediaOwnerModelClass);
  }

  async buildQuery<T extends Model>(modelClass: ModelCtor<T>, query: EntityQueryDto, include?: Includeable[]) {
    if (query.taskIds != null) {
      // special case for internal sideloading.
      return new PaginatedQueryBuilder(modelClass, undefined, include);
    }
    return PaginatedQueryBuilder.forNumberPage(modelClass, query.page, include);
  }

  fullUrl = (media: Media) => this.mediaService.getUrl(media);
  thumbnailUrl = (media: Media) => this.mediaService.getUrl(media, "thumbnail");

  duplicateMedia = (media: Media, newOwner: MediaOwnerModel) => this.mediaService.duplicateMedia(media, newOwner);

  mediaDto(media: Media, additional: AssociationDtoAdditionalProps) {
    return new MediaDto(media, {
      url: this.fullUrl(media),
      thumbUrl: this.thumbnailUrl(media),
      ...additional
    });
  }

  embeddedMediaDto(media: Media) {
    return this.mediaService.embeddedMediaDto(media);
  }

  mapMediaCollection(media: Media[], collection: MediaCollection, entityType: EntityType, entityUuid: string) {
    const grouped = groupBy(media, "collectionName");
    return Object.entries(collection).reduce(
      (dtoMap, [collection, { multiple, dbCollection }]) => ({
        ...dtoMap,
        [collection]: multiple
          ? (grouped[dbCollection] ?? []).map(media => this.mediaDto(media, { entityType, entityUuid }))
          : grouped[dbCollection] == null
            ? null
            : this.mediaDto(grouped[dbCollection][0], { entityType, entityUuid })
      }),
      {} as Dictionary<MediaDto | MediaDto[] | null>
    );
  }

  createLinkedAnswerCollector() {
    return new LinkedAnswerCollector(this.mediaService);
  }

  writeCsv(...args: Parameters<CsvExportService["writeCsv"]>) {
    return this.csvExportService.writeCsv(...args);
  }

  async entityExport<T extends EntityModel>(
    type: EntityType,
    columns: Dictionary<string>,
    source: PaginatedQueryBuilder<T> | T[],
    { attributes, target, frameworkKey, additionalDataForPage, ability, fileName }: EntityFrameworkExportOptions<T>
  ) {
    const model = ENTITY_MODELS[type];
    const form = await Form.for(model.build({ frameworkKey })).findOne();
    if (form == null) {
      this.logger.log(`No form found for [${model.name}, ${frameworkKey}]`);
      return;
    }

    const frontendUrl = this.configService.get<string>("APP_FRONT_END") ?? "https://www.terramatch.org";
    const prefix = target == null ? "all-entity-records/" : "";
    fileName ??= `${prefix}${kebabCase(type)}-${frameworkKey}.csv`;
    const mappings = await getFormQuestionsForExport(form);
    if (attributes != null && source instanceof PaginatedQueryBuilder) {
      source = source.attributes(uniq(["id", "frameworkKey", ...attributes, ...getAttributes(mappings, type)]));
    }
    await this.writeCsv(fileName, target, { ...columns, ...getMappingsColumns(mappings) }, async addRow => {
      const processPage = async (page: T[]) => {
        if (ability != null) await this.policyService.authorize(ability, page);
        const pageData = (await additionalDataForPage?.(page as T[])) ?? {};
        for (const entity of page) {
          const entityModel = entity as T;
          const additional = {
            ...(isLinkedEntityModel(entityModel)
              ? { linkToTerramatch: entityModel.linkToTerramatch(frontendUrl) }
              : {}),
            ...(await this.csvExportService.collectFormCells(mappings, { [type]: entityModel }, frameworkKey)),
            ...pageData[entity.id]
          };
          addRow(entity, additional);
        }
      };

      if (source instanceof PaginatedQueryBuilder) {
        for await (const page of batchFindAll(source)) {
          await processPage(page as T[]);
        }
      } else {
        await processPage(source);
      }
    });
  }

  async exportMedia<T extends EntityModel>(
    models: T[],
    archive: Archiver,
    generateFileName: (model: T, media: Media) => string,
    progressTick?: ProgressTick
  ) {
    const media = await Media.for(models).findAll();
    // In the case of a ton of media, we want to avoid trying to stream them all to / from S3
    // at once, so chunk into smaller sets and process each set before moving on to the next.
    for (const subset of chunk(media, 5)) {
      await Promise.allSettled(
        subset.map(async m => {
          try {
            const stream = await this.mediaService.getMediaStream(m);
            const model = models.find(({ id }) => id === m.modelId) as T;
            archive.append(stream, { name: generateFileName(model, m) });
            await progressTick?.();
          } catch (err) {
            // swallow errors with a warning to prevent the archive stream as a whole from failing
            const message = err instanceof Error ? err.message : `${err}`;
            this.logger.warn(`Failed to get asset stream [${message}]`, {
              mediaId: m.id,
              mediaFileName: m.fileName
            });
          }
        })
      );
    }
  }
}
