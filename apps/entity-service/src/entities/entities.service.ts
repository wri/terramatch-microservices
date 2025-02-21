import { BadRequestException, Injectable } from "@nestjs/common";
import { DemographicProcessor, ProjectProcessor, SiteProcessor } from "./processors";
import { Model, ModelCtor } from "sequelize-typescript";
import { EntityProcessor } from "./processors/entity-processor";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Media } from "@terramatch-microservices/database/entities";
import { MediaDto } from "./dto/media.dto";
import { MediaCollection } from "@terramatch-microservices/database/types/media";
import { groupBy } from "lodash";
import { Includeable } from "sequelize";
import { EntityDto } from "./dto/entity.dto";
import { AssociationProcessor } from "./processors/association-processor";
import { AssociationDto } from "./dto/association.dto";
import { ENTITY_MODELS, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";

// The keys of this array must match the type in the resulting DTO.
const ENTITY_PROCESSORS = {
  projects: ProjectProcessor,
  sites: SiteProcessor
};

export type ProcessableEntity = keyof typeof ENTITY_PROCESSORS;
export const PROCESSABLE_ENTITIES = Object.keys(ENTITY_PROCESSORS) as ProcessableEntity[];

const ASSOCIATION_PROCESSORS = {
  demographics: DemographicProcessor
};

export type ProcessableAssociation = keyof typeof ASSOCIATION_PROCESSORS;
export const PROCESSABLE_ASSOCIATIONS = Object.keys(ASSOCIATION_PROCESSORS) as ProcessableAssociation[];

const MAX_PAGE_SIZE = 100 as const;

@Injectable()
export class EntitiesService {
  constructor(private readonly mediaService: MediaService) {}

  createEntityProcessor<T extends Model<T>>(entity: ProcessableEntity) {
    const processorClass = ENTITY_PROCESSORS[entity];
    if (processorClass == null) {
      throw new BadRequestException(`Entity type invalid: ${entity}`);
    }

    return new processorClass(this) as unknown as EntityProcessor<T, EntityDto, EntityDto>;
  }

  createAssociationProcessor<T extends Model<T>, D extends AssociationDto<D>, E extends EntityModel>(
    entityType: EntityType,
    uuid: string,
    association: ProcessableAssociation
  ) {
    const processorClass = ASSOCIATION_PROCESSORS[association];
    if (processorClass == null) {
      throw new BadRequestException(`Association type invalid: ${entityType}`);
    }

    const entityModelClass = ENTITY_MODELS[entityType];
    if (entityModelClass == null) {
      throw new BadRequestException(`Entity type invalid: ${entityType}`);
    }

    return new processorClass(entityType, uuid, entityModelClass) as unknown as AssociationProcessor<T, D, E>;
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

  mediaDto = (media: Media) => new MediaDto(media, this.fullUrl(media), this.thumbnailUrl(media));

  mapMediaCollection(media: Media[], collection: MediaCollection) {
    const grouped = groupBy(media, "collectionName");
    return Object.entries(collection).reduce(
      (dtoMap, [collection, { multiple, dbCollection }]) => ({
        ...dtoMap,
        [collection]: multiple
          ? (grouped[dbCollection] ?? []).map(media => this.mediaDto(media))
          : grouped[dbCollection] == null
          ? null
          : this.mediaDto(grouped[dbCollection][0])
      }),
      {}
    );
  }
}
