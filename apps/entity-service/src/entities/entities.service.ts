import { BadRequestException, Injectable } from "@nestjs/common";
import { ProjectProcessor } from "./processors";
import { SiteProcessor } from "./processors/site.processor";
import { Model, ModelCtor } from "sequelize-typescript";
import { EntityProcessor } from "./processors/entity-processor";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";

// The keys of this array must match the type in the resulting DTO.
const ENTITY_PROCESSORS = {
  projects: ProjectProcessor,
  sites: SiteProcessor
};

export type ProcessableEntity = keyof typeof ENTITY_PROCESSORS;
export const PROCESSABLE_ENTITIES = Object.keys(ENTITY_PROCESSORS) as ProcessableEntity[];

const MAX_PAGE_SIZE = 100 as const;

@Injectable()
export class EntitiesService {
  createProcessor<T extends Model<T>>(entity: ProcessableEntity) {
    const processorClass = ENTITY_PROCESSORS[entity];
    if (processorClass == null) {
      throw new BadRequestException(`Entity type invalid: ${entity}`);
    }

    return new processorClass(this) as unknown as EntityProcessor<T>;
  }

  async buildQuery<T extends Model<T>>(modelClass: ModelCtor<T>, query: EntityQueryDto) {
    const { size: pageSize = MAX_PAGE_SIZE, after: pageAfter } = query.page ?? {};
    if (pageSize > MAX_PAGE_SIZE || pageSize < 1) {
      throw new BadRequestException("Page size is invalid");
    }

    const builder = new PaginatedQueryBuilder(modelClass, pageSize);
    if (pageAfter != null) {
      await builder.pageAfter(pageAfter);
    }

    return builder;
  }
}
