import { BadRequestException, Injectable } from "@nestjs/common";
import { ProjectProcessor, SiteProcessor } from "./processors";
import { Model, ModelCtor } from "sequelize-typescript";
import { EntityProcessor } from "./processors/entity-processor";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Demographic, Media, Seeding, TreeSpecies, User } from "@terramatch-microservices/database/entities";
import { MediaDto } from "./dto/media.dto";
import { MediaCollection } from "@terramatch-microservices/database/types/media";
import { groupBy } from "lodash";
import { col, fn, Includeable } from "sequelize";
import { EntityDto } from "./dto/entity.dto";
import { AssociationProcessor } from "./processors/association-processor";
import { AssociationDto } from "./dto/association.dto";
import { NurseryProcessor } from "./processors/nursery.processor";
import { ENTITY_MODELS, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { ProjectReportProcessor } from "./processors/project-report.processor";
import { NurseryReportProcessor } from "./processors/nursery-report.processor";
import { SiteReportProcessor } from "./processors/site-report.processor";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { SeedingDto } from "./dto/seeding.dto";
import { TreeSpeciesDto } from "./dto/tree-species.dto";
import { DemographicDto } from "./dto/demographic.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaProcessor } from "./processors/media.processor";
import { EntityUpdateData } from "./dto/entity-update.dto";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ITranslateParams } from "@transifex/native";
import { MediaAssociationDtoAdditionalProps } from "./dto/media-association.dto";
import { MediaQueryDto } from "./dto/media-query.dto";

// The keys of this array must match the type in the resulting DTO.
const ENTITY_PROCESSORS = {
  projects: ProjectProcessor,
  sites: SiteProcessor,
  nurseries: NurseryProcessor,
  projectReports: ProjectReportProcessor,
  nurseryReports: NurseryReportProcessor,
  siteReports: SiteReportProcessor
};

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
  media: MediaProcessor
};

export type ProcessableAssociation = keyof typeof ASSOCIATION_PROCESSORS;
export const PROCESSABLE_ASSOCIATIONS = Object.keys(ASSOCIATION_PROCESSORS) as ProcessableAssociation[];

export const MAX_PAGE_SIZE = 100 as const;

@Injectable()
export class EntitiesService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly policyService: PolicyService,
    private readonly localizationService: LocalizationService
  ) {}

  get userId() {
    return this.policyService.userId;
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

  private _userLocale?: string;
  async getUserLocale() {
    if (this._userLocale == null) {
      this._userLocale = (await User.findOne({ where: { id: this.userId }, attributes: ["locale"] })).locale ?? "en-GB";
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

    return new processorClass(this, entity) as unknown as EntityProcessor<T, EntityDto, EntityDto, EntityUpdateData>;
  }

  createAssociationProcessor<T extends UuidModel, D extends AssociationDto<D>>(
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

  async buildQuery<T extends Model<T>>(modelClass: ModelCtor<T>, query: EntityQueryDto, include?: Includeable[]) {
    const { size: pageSize = MAX_PAGE_SIZE, number: pageNumber = 1 } = query.page ?? {};
    if (pageSize > MAX_PAGE_SIZE || pageSize < 1) {
      throw new BadRequestException("Page size is invalid");
    }
    if (pageNumber < 1) {
      throw new BadRequestException("Page number is invalid");
    }

    const builder = new PaginatedQueryBuilder(modelClass, pageSize, include);
    if (pageNumber > 1) {
      builder.pageNumber(pageNumber);
    }

    return builder;
  }

  fullUrl = (media: Media) => this.mediaService.getUrl(media);
  thumbnailUrl = (media: Media) => this.mediaService.getUrl(media, "thumbnail");

  mediaDto(media: Media, additional: MediaAssociationDtoAdditionalProps) {
    return new MediaDto(media, {
      url: this.fullUrl(media),
      thumbUrl: this.thumbnailUrl(media),
      ...additional
    });
  }

  mapMediaCollection(media: Media[], collection: MediaCollection, entityType: EntityType) {
    const grouped = groupBy(media, "collectionName");
    return Object.entries(collection).reduce(
      (dtoMap, [collection, { multiple, dbCollection }]) => ({
        ...dtoMap,
        [collection]: multiple
          ? (grouped[dbCollection] ?? []).map(media => this.mediaDto(media, { modelType: entityType }))
          : grouped[dbCollection] == null
          ? null
          : this.mediaDto(grouped[dbCollection][0], { modelType: entityType })
      }),
      {}
    );
  }
}
