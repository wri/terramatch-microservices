import { Model, ModelCtor } from "sequelize-typescript";
import {
  Attributes,
  Filterable,
  FindOptions,
  Includeable,
  IncludeOptions,
  Op,
  OrderItem,
  WhereOptions
} from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { cloneDeep, flatten, isArray, isObject, omit } from "lodash";

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

const isRequiredInclude = (include: Includeable): include is IncludeOptions =>
  isObject(include) && Object.hasOwn(include, "required") && (include as IncludeOptions).required === true;

const filterRequiredIncludes = (includes?: Includeable | Includeable[]): IncludeOptions[] =>
  (isArray(includes) ? includes : includes == null ? [] : [includes]).filter(isRequiredInclude).map(include => ({
    ...omit(include, ["attributes", "include"]),
    include: filterRequiredIncludes(include.include)
  }));

export class PaginatedQueryBuilder<T extends Model<T>> {
  protected findOptions: FindOptions<Attributes<T>> = {
    order: ["id"]
  };
  protected pageAfterId: number | undefined;

  constructor(private readonly MODEL: ModelCtor<T>, private readonly pageSize: number, include?: Includeable[]) {
    this.findOptions.limit = this.pageSize;
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
    const findOptions = cloneDeep(this.findOptions);
    if (this.pageAfterId != null) {
      findOptions.where = combineWheresWithAnd(findOptions.where ?? {}, { id: { [Op.gt]: this.pageAfterId } });
    }
    return await this.MODEL.findAll(findOptions);
  }

  async paginationTotal() {
    const findOptions = {
      where: this.findOptions.where,
      include: filterRequiredIncludes(this.findOptions.include)
    };
    return await this.MODEL.count(findOptions);
  }
}
