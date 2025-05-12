import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, Filterable, FindOptions, Includeable, Op, OrderItem, WhereOptions } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { flatten, isObject } from "lodash";
import { NumberPage } from "../dto/page.dto";

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

export function combineWheresWithAnd(whereA: WhereOptions, whereB: WhereOptions) {
  const unpackedA = unpackAnd(whereA);
  if (unpackedA === undefined) return whereB;
  const unpackedB = unpackAnd(whereB);
  if (unpackedB === undefined) return whereA;
  return { [Op.and]: flatten([unpackedA, unpackedB]) };
}

export const MAX_PAGE_SIZE = 100 as const;

export class PaginatedQueryBuilder<T extends Model<T>> {
  public static forNumberPage<T extends Model<T>>(
    modelClass: ModelCtor<T>,
    page?: NumberPage,
    include?: Includeable[]
  ) {
    const { size: pageSize = MAX_PAGE_SIZE, number: pageNumber = 1 } = page ?? {};
    if (pageSize > MAX_PAGE_SIZE || pageSize < 1) {
      throw new BadRequestException(`Invalid page size: ${pageSize}`);
    }
    if (pageNumber < 1) {
      throw new BadRequestException(`Invalid page number: ${pageNumber}`);
    }

    const builder = new PaginatedQueryBuilder(modelClass, pageSize, include);
    if (pageNumber > 1) {
      builder.pageNumber(pageNumber);
    }

    return builder;
  }

  protected findOptions: FindOptions<Attributes<T>> = {
    order: ["id"]
  };
  protected pageAfterId: number | undefined;

  constructor(private readonly MODEL: ModelCtor<T>, private readonly pageSize?: number, include?: Includeable[]) {
    if (this.pageSize != null) {
      this.findOptions.limit = this.pageSize;
    }
    if (include != null && include.length > 0) {
      this.findOptions.include = include;
    }
  }

  order(order: OrderItem) {
    this.findOptions.order = [order];
    return this;
  }

  async pageAfter(pageAfter: string) {
    const instance = await this.MODEL.findOne({ where: { uuid: pageAfter } as WhereOptions, attributes: ["id"] });
    if (instance == null) throw new BadRequestException(`No ${this.MODEL.name} found for uuid: ${pageAfter}`);

    // This gets combined into only the `execute` query, and ignored for the `paginationTotal` query,
    // so we don't combine it into find options now.
    this.pageAfterId = instance.id;
    return this;
  }

  pageNumber(pageNumber: number) {
    this.findOptions.offset = (pageNumber - 1) * this.pageSize;
    return this;
  }

  where(options: WhereOptions, filterable?: Filterable) {
    if (filterable == null) filterable = this.findOptions;
    filterable.where = combineWheresWithAnd(filterable.where ?? {}, options);
    return this;
  }

  async execute() {
    const findOptions = { ...this.findOptions };
    if (this.pageAfterId != null) {
      findOptions.where = combineWheresWithAnd(findOptions.where ?? {}, { id: { [Op.gt]: this.pageAfterId } });
    }
    return await this.MODEL.findAll(findOptions);
  }

  async paginationTotal() {
    return await this.MODEL.count({ distinct: true, ...this.findOptions });
  }
}
