import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, WhereOptions } from "sequelize";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntitiesService } from "../entities.service";
import { EntityQueryDto } from "../dto/entity-query.dto";

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

export abstract class EntityProcessor<ModelType extends Model<ModelType>> {
  constructor(protected readonly entitiesService: EntitiesService) {}

  abstract findOne(uuid: string): Promise<ModelType | null>;
  abstract findMany(query: EntityQueryDto, userId: number, permissions: string[]): Promise<ModelType[]>;

  abstract addFullDto(document: DocumentBuilder, model: ModelType): Promise<void>;
  abstract addLightDto(document: DocumentBuilder, model: ModelType): Promise<void>;
}
