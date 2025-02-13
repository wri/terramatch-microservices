import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, Filterable, FindOptions, Op, WhereOptions } from "sequelize";
import { BadRequestException } from "@nestjs/common";

export class PaginatedQueryBuilder<T extends Model<T>> {
  protected findOptions: FindOptions<Attributes<T>> = {
    order: ["id"]
  };

  constructor(private readonly MODEL: ModelCtor<T>, pageSize: number) {
    this.findOptions.limit = pageSize;
  }

  async pageAfter(pageAfter: string) {
    const instance = await this.MODEL.findOne({ where: { uuid: pageAfter } as WhereOptions, attributes: ["id"] });
    if (instance == null) throw new BadRequestException(`No ${this.MODEL.name} found for uuid: ${pageAfter}`);
    return this.where({ id: { [Op.gt]: instance.id } });
  }

  where(options: WhereOptions, filterable: Filterable = this.findOptions) {
    if (filterable.where == null) filterable.where = {};

    const clauses = { ...options } as WhereOptions;
    if (clauses[Op.and] != null && filterable.where[Op.and] != null) {
      // For this builder, we only use arrays of literals with Op.and, so we can simply merge the arrays
      clauses[Op.and] = [...filterable.where[Op.and], ...clauses[Op.and]];
    }

    Object.assign(filterable.where, clauses);

    return this;
  }

  async execute() {
    return await this.MODEL.findAll(this.findOptions);
  }
}
