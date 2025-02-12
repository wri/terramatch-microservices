import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, Includeable, WhereOptions } from "sequelize";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

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
  abstract readonly MODEL: ModelCtor<ModelType>;

  async findOne(uuid: string): Promise<ModelType | undefined> {
    const where = {} as WhereOptions<ModelType>;
    where["uuid"] = uuid;
    return await this.MODEL.findOne({ where, include: this.findFullIncludes() });
  }

  abstract addFullDto(document: DocumentBuilder, model: ModelType): Promise<void>;

  /**
   * Override to include some associations in the initial find query
   */
  protected findFullIncludes(): Includeable[] {
    return [];
  }
}
