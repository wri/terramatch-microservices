import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, Filterable, FindOptions, Op, WhereOptions } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { flatten, isObject } from "lodash";

// Some utilities copied from the un-exported bowels of Sequelize to help merge where clauses. Pulled
// from model.js in the code paths where multiple scopes can be combined with a query's WhereOptions to
// create a single WhereOptions.
const operatorSet = new Set(Object.values(Op));
function getComplexKeys(obj: object) {
  const symbols = Object.getOwnPropertySymbols(obj).filter(s => operatorSet.has(s)) as (symbol | string)[];
  return symbols.concat(Object.keys(obj));
}

function unpackAnd(where: WhereOptions) {
  if (!isObject(where)) return where;

  const keys = getComplexKeys(where);
  if (keys.length === 0) return;
  if (keys.length !== 1 || keys[0] !== Op.and) return where;
  return where[Op.and];
}

function combineWheresWithAnd(whereA: WhereOptions, whereB: WhereOptions) {
  const unpackedA = unpackAnd(whereA);
  if (unpackedA === undefined) return whereB;
  const unpackedB = unpackAnd(whereB);
  if (unpackedB === undefined) return whereA;
  return { [Op.and]: flatten([unpackedA, unpackedB]) };
}

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
    filterable.where = combineWheresWithAnd(filterable.where ?? {}, options);
    return this;
  }

  async execute() {
    return await this.MODEL.findAll(this.findOptions);
  }
}
