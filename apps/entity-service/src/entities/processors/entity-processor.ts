import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, WhereOptions } from "sequelize";
import { DocumentBuilder, getStableRequestQuery, IndexData } from "@terramatch-microservices/common/util";
import { EntitiesService, ProcessableEntity } from "../entities.service";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException, Type } from "@nestjs/common";
import { EntityDto } from "../dto/entity.dto";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { Action } from "@terramatch-microservices/database/entities/action.entity";
import { EntityUpdateData } from "../dto/entity-update.dto";
import { APPROVED, NEEDS_MORE_INFORMATION } from "@terramatch-microservices/database/constants/status";

export type Aggregate<M extends Model<M>> = {
  func: string;
  attr: keyof Attributes<M>;
};

export async function aggregateColumns<M extends Model<M>>(
  model: ModelCtor<M>,
  aggregates: Aggregate<M>[],
  where?: WhereOptions<M>
) {
  return (
    await model.findAll({
      where,
      raw: true,
      attributes: aggregates.map(({ func, attr }) => [fn(func, col(model.getAttributes()[attr].field)), attr as string])
    })
  )[0];
}

export type PaginatedResult<ModelType extends EntityModel> = {
  models: ModelType[];
  paginationTotal: number;
};

export type DtoResult<DtoType extends EntityDto> = {
  id: string;
  dto: DtoType;
};

const getIndexData = (
  resource: ProcessableEntity,
  query: EntityQueryDto,
  total: number,
  pageNumber: number
): Omit<IndexData, "ids"> => {
  const requestPath = `/entities/v3/${resource}${getStableRequestQuery(query)}`;
  return { resource, requestPath, total, pageNumber };
};

export abstract class EntityProcessor<
  ModelType extends EntityModel,
  LightDto extends EntityDto,
  FullDto extends EntityDto,
  UpdateDto extends EntityUpdateData
> {
  abstract readonly LIGHT_DTO: Type<LightDto>;
  abstract readonly FULL_DTO: Type<FullDto>;

  readonly APPROVAL_STATUSES = [APPROVED, NEEDS_MORE_INFORMATION];

  constructor(protected readonly entitiesService: EntitiesService, protected readonly resource: ProcessableEntity) {}

  abstract findOne(uuid: string): Promise<ModelType | null>;
  abstract findMany(query: EntityQueryDto): Promise<PaginatedResult<ModelType>>;

  abstract getFullDto(model: ModelType): Promise<DtoResult<FullDto>>;
  abstract getLightDto(model: ModelType): Promise<DtoResult<LightDto>>;

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processSideload(
    document: DocumentBuilder,
    model: ModelType,
    entity: ProcessableEntity,
    pageSize: number
  ): Promise<void> {
    throw new BadRequestException("This entity does not support sideloading");
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  async addIndex(document: DocumentBuilder, query: EntityQueryDto, sideloaded = false) {
    const { models, paginationTotal } = await this.findMany(query);
    const indexData = getIndexData(this.resource, query, paginationTotal, query.page?.number ?? 1);

    const indexIds: string[] = [];
    if (models.length !== 0) {
      await this.entitiesService.authorize("read", models);

      for (const model of models) {
        const { id, dto } = await this.getLightDto(model);
        indexIds.push(id);
        if (sideloaded) document.addIncluded(id, dto);
        else document.addData(id, dto);
      }
    }

    document.addIndexData({ ...indexData, ids: indexIds });

    if (models.length > 0 && !sideloaded && query.sideloads != null && query.sideloads.length > 0) {
      for (const model of models) {
        for (const { entity, pageSize } of query.sideloads) {
          await this.processSideload(document, model, entity, pageSize);
        }
      }
    }
  }

  async delete(model: ModelType) {
    await Action.for(model).destroy();
    await model.destroy();
  }

  /**
   * Performs the basic function of setting fields in EntityUpdateAttributes and saving the model.
   * If this concrete processor needs to support more fields on the update dto, override this method
   * and set the appropriate fields and then call super.update()
   */
  async update(model: ModelType, update: UpdateDto) {
    if (update.status != null) {
      if (this.APPROVAL_STATUSES.includes(update.status)) {
        await this.entitiesService.authorize("approve", model);

        // If an admin is doing an update, set the feedback / feedbackFields to whatever is in the
        // request, even if it's null. We ignore feedback / feedbackFields if the status is not
        // also being updated.
        model.feedback = update.feedback;
        model.feedbackFields = update.feedbackFields;
      }

      model.status = update.status as ModelType["status"];
    }

    await model.save();
  }
}
