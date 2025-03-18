import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, WhereOptions } from "sequelize";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntitiesService } from "../entities.service";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Type } from "@nestjs/common";
import { EntityDto } from "../dto/entity.dto";
import { EntityClass, EntityModel } from "@terramatch-microservices/database/constants/entities";
import { Action } from "@terramatch-microservices/database/entities/action.entity";

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

export abstract class EntityProcessor<
  ModelType extends EntityModel,
  LightDto extends EntityDto,
  FullDto extends EntityDto
> {
  abstract readonly LIGHT_DTO: Type<LightDto>;
  abstract readonly FULL_DTO: Type<FullDto>;

  constructor(protected readonly entitiesService: EntitiesService) {}

  abstract findOne(uuid: string): Promise<ModelType | null>;
  abstract findMany(query: EntityQueryDto, userId: number, permissions: string[]): Promise<PaginatedResult<ModelType>>;

  abstract addFullDto(document: DocumentBuilder, model: ModelType): Promise<void>;
  abstract addLightDto(document: DocumentBuilder, model: ModelType): Promise<void>;

  async delete(model: ModelType) {
    await Action.targetable((model.constructor as EntityClass<ModelType>).LARAVEL_TYPE, model.id).destroy();
    await model.destroy();
  }
}
