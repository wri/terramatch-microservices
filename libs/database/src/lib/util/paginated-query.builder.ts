import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, Filterable, FindOptions, Includeable, Op, WhereOptions } from "sequelize";
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
  protected pageTotalFindOptions: FindOptions<Attributes<T>> = {};

  constructor(private readonly MODEL: ModelCtor<T>, pageSize: number, include?: Includeable[]) {
    this.findOptions.limit = pageSize;
    if (include != null && include.length > 0) {
      this.findOptions.include = include;
    }
  }

  async pageAfter(pageAfter: string) {
    const instance = await this.MODEL.findOne({ where: { uuid: pageAfter } as WhereOptions, attributes: ["id"] });
    if (instance == null) throw new BadRequestException(`No ${this.MODEL.name} found for uuid: ${pageAfter}`);

    // Avoid using this.where() so that we don't include this in the pageTotalFindOptions
    this.findOptions.where = combineWheresWithAnd(this.findOptions.where ?? {}, { id: { [Op.gt]: instance.id } });
    return this;
  }

  pageNumber(pageNumber: number) {
    this.findOptions.offset = pageNumber;
    return this;
  }

  where(options: WhereOptions, filterable?: Filterable) {
    if (filterable == null) {
      this.pageTotalFindOptions.where = combineWheresWithAnd(this.pageTotalFindOptions.where ?? {}, options);
      filterable = this.findOptions;
    }
    filterable.where = combineWheresWithAnd(filterable.where ?? {}, options);
    return this;
  }

  async execute() {
    return await this.MODEL.findAll(this.findOptions);
  }

  async paginationTotal() {
    return await this.MODEL.count(this.pageTotalFindOptions);
  }
}
