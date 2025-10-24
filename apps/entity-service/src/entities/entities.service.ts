import { BadRequestException, Injectable } from "@nestjs/common";
import { ProjectProcessor, SiteProcessor } from "./processors";
import { Model, ModelCtor } from "sequelize-typescript";
import { EntityProcessor } from "./processors/entity-processor";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import {
  Demographic,
  Disturbance,
  Media,
  Seeding,
  TreeSpecies,
  User
} from "@terramatch-microservices/database/entities";
import { MediaDto } from "./dto/media.dto";
import { MediaCollection } from "@terramatch-microservices/database/types/media";
import { groupBy } from "lodash";
import { col, fn, Includeable } from "sequelize";
import { EntityDto } from "./dto/entity.dto";
import { AssociationProcessor } from "./processors/association-processor";
import { AssociationDto, AssociationDtoAdditionalProps } from "./dto/association.dto";
import { NurseryProcessor } from "./processors/nursery.processor";
import { ENTITY_MODELS, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { ProjectReportProcessor } from "./processors/project-report.processor";
import { NurseryReportProcessor } from "./processors/nursery-report.processor";
import { SiteReportProcessor } from "./processors/site-report.processor";
import { FinancialReportProcessor } from "./processors/financial-report.processor";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { SeedingDto } from "./dto/seeding.dto";
import { TreeSpeciesDto } from "./dto/tree-species.dto";
import { DemographicDto } from "./dto/demographic.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaProcessor } from "./processors/media.processor";
import { EntityUpdateData } from "./dto/entity-update.dto";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ITranslateParams } from "@transifex/native";
import { MediaQueryDto } from "./dto/media-query.dto";
import { Invasive } from "@terramatch-microservices/database/entities/invasive.entity";
import { DisturbanceDto } from "./dto/disturbance.dto";
import { InvasiveDto } from "./dto/invasive.dto";
import { Strata } from "@terramatch-microservices/database/entities/stratas.entity";
import { StrataDto } from "./dto/strata.dto";
import { MEDIA_OWNER_MODELS, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { MediaOwnerProcessor } from "./processors/media-owner-processor";
import { DisturbanceReportProcessor } from "./processors/disturbance-report.processor";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { EntityCreateData } from "./dto/entity-create.dto";

// The keys of this array must match the type in the resulting DTO.
export const ENTITY_PROCESSORS = {
  projects: ProjectProcessor,
  sites: SiteProcessor,
  nurseries: NurseryProcessor,
  projectReports: ProjectReportProcessor,
  nurseryReports: NurseryReportProcessor,
  siteReports: SiteReportProcessor,
  financialReports: FinancialReportProcessor,
  disturbanceReports: DisturbanceReportProcessor
} as const;

export type ProcessableEntity = keyof typeof ENTITY_PROCESSORS;
export const PROCESSABLE_ENTITIES = Object.keys(ENTITY_PROCESSORS) as ProcessableEntity[];
export const POLYGON_STATUSES_FILTERS = [
  "no-polygons",
  "submitted",
  "approved",
  "needs-more-information",
  "draft"
] as const;

export type PolygonStatusFilter = (typeof POLYGON_STATUSES_FILTERS)[number];

const ASSOCIATION_PROCESSORS = {
  demographics: AssociationProcessor.buildSimpleProcessor(
    DemographicDto,
    ({ id: demographicalId }, demographicalType) =>
      Demographic.findAll({
        where: { demographicalType, demographicalId, hidden: false },
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

@Injectable()
export class EntitiesService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly policyService: PolicyService,
    private readonly localizationService: LocalizationService
  ) {}

  get userId() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.policyService.userId!;
  }

  async getPermissions() {
    return await this.policyService.getPermissions();
  }

  async authorize(action: string, subject: Model | Model[]) {
    await this.policyService.authorize(action, subject);
  }

  async isFrameworkAdmin<T extends EntityModel>({ frameworkKey }: T) {
    return (await this.getPermissions()).includes(`framework-${frameworkKey}`);
  }

  private _userLocale?: ValidLocale;
  async getUserLocale() {
    if (this._userLocale == null) {
      this._userLocale = (await User.findLocale(this.userId)) ?? "en-US";
    }
    return this._userLocale;
  }

  async localizeText(text: string, params?: ITranslateParams) {
    return await this.localizationService.localizeText(text, await this.getUserLocale(), params);
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

  async buildQuery<T extends Model<T>>(modelClass: ModelCtor<T>, query: EntityQueryDto, include?: Includeable[]) {
    if (query.taskId != null) {
      // special case for internal sideloading.
      return new PaginatedQueryBuilder(modelClass, undefined, include);
    }
    return PaginatedQueryBuilder.forNumberPage(modelClass, query.page, include);
  }

  fullUrl = (media: Media) => this.mediaService.getUrl(media);
  thumbnailUrl = (media: Media) => this.mediaService.getUrl(media, "thumbnail");

  mediaDto(media: Media, additional: AssociationDtoAdditionalProps) {
    return new MediaDto(media, {
      url: this.fullUrl(media),
      thumbUrl: this.thumbnailUrl(media),
      ...additional
    });
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
      {}
    );
  }
}
