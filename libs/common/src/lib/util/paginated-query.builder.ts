import { Model, ModelCtor } from "sequelize-typescript";
import {
  Attributes,
  Filterable,
  FindOptions,
  GroupOption,
  Includeable,
  Op,
  OrderItem,
  ProjectionAlias,
  WhereOptions
} from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { flatten, isEmpty, isObject } from "lodash";
import { CursorPage, NumberPage } from "../dto/page.dto";
import { ComputedAttribute } from "@terramatch-microservices/database/types/util";

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
  return (where as { [Op.and]: WhereOptions[] })[Op.and];
}

export function combineWheresWithAnd(whereA: WhereOptions, whereB: WhereOptions) {
  const unpackedA = unpackAnd(whereA);
  if (unpackedA === undefined) return whereB;
  const unpackedB = unpackAnd(whereB);
  if (unpackedB === undefined) return whereA;
  return { [Op.and]: flatten([unpackedA, unpackedB]) };
}

export const MAX_PAGE_SIZE = 100 as const;

const validatePageSize = (pageSize: number) => {
  if (pageSize > MAX_PAGE_SIZE || pageSize < 1) {
    throw new BadRequestException(`Invalid page size: ${pageSize}`);
  }
};

export class PaginatedQueryBuilder<T extends Model> {
  /**
   * Validates the page size only; the caller is responsible for calling pageAfter() when page.after is set.
   */
  public static forCursorPage<T extends Model>(modelClass: ModelCtor<T>, page?: CursorPage, include?: Includeable[]) {
    const pageSize = page?.size ?? MAX_PAGE_SIZE;
    validatePageSize(pageSize);
    return new PaginatedQueryBuilder(modelClass, pageSize, include);
  }

  public static forNumberPage<T extends Model>(modelClass: ModelCtor<T>, page?: NumberPage, include?: Includeable[]) {
    const { size: pageSize = MAX_PAGE_SIZE, number: pageNumber = 1 } = page ?? {};
    validatePageSize(pageSize);
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
  protected computedAttributes: ComputedAttribute[];
  protected pageAfterId: number | undefined;

  constructor(
    private readonly MODEL: ModelCtor<T>,
    public readonly pageSize?: number,
    include?: Includeable[]
  ) {
    if (this.pageSize != null) {
      this.findOptions.limit = this.pageSize;
    }
    if (include != null && include.length > 0) {
      this.findOptions.include = include;
    }
  }

  order(order: OrderItem[]) {
    this.findOptions.order = order;
    return this;
  }

  /**
   * By default, the cursor is the uuid of the last record on the previous page. Models without a
   * uuid column may provide the where clause that finds the cursor record instead.
   */
  async pageAfter(pageAfter: string, where: WhereOptions = { uuid: pageAfter }) {
    const instance = await this.MODEL.findOne({ where, attributes: ["id"] });
    if (instance == null) throw new BadRequestException(`No ${this.MODEL.name} found for uuid: ${pageAfter}`);

    // This gets combined into only the `execute` query, and ignored for the `paginationTotal` query,
    // so we don't combine it into find options now.
    this.pageAfterId = instance.id;
    return this;
  }

  pageNumber(pageNumber: number) {
    if (this.pageSize == null) {
      throw new BadRequestException("Cannot set page number without page size");
    }
    this.findOptions.offset = (pageNumber - 1) * this.pageSize;
    return this;
  }

  attributes(attributes: (string | ProjectionAlias)[]) {
    this.findOptions.attributes = attributes;
    return this;
  }

  /**
   * Use with caution! Two things to note:
   *  1) This will cause the `attributes` member of findOptions to be set at the time of the
   *     execute() query, which means that the default behavior of fetching all attributes will
   *     not happen. If attributes other than the computed attributes are required on this query,
   *     they must be set with the `attributes()` method on this builder.
   *  2) Computed attributes typically require a GROUP BY clause (usually the primary key on the
   *     model), which must be set with the `group()` method on this builder.
   */
  addComputedAttribute(attribute: ComputedAttribute) {
    (this.computedAttributes ??= []).push(attribute);
    return this;
  }

  group(group: GroupOption) {
    this.findOptions.group = group;
    return this;
  }

  where(options: WhereOptions, filterable?: Filterable) {
    if (filterable == null) filterable = this.findOptions;
    filterable.where = combineWheresWithAnd(filterable.where ?? {}, options);
    return this;
  }

  async execute() {
    const findOptions = { ...this.findOptions };
    if (!isEmpty(this.computedAttributes)) {
      findOptions.include = [
        ...((findOptions.include ?? []) as Includeable[]),
        ...this.computedAttributes.map(({ include }) => include)
      ];
      findOptions.attributes = [
        ...((findOptions.attributes ?? []) as (string | ProjectionAlias)[]),
        ...this.computedAttributes.map(({ attribute }) => attribute)
      ];
    }
    if (this.pageAfterId != null) {
      findOptions.where = combineWheresWithAnd(findOptions.where ?? {}, { id: { [Op.gt]: this.pageAfterId } });
    }
    return await this.MODEL.findAll(findOptions);
  }

  async paginationTotal() {
    const findOptions = { distinct: true, ...this.findOptions, attributes: [] };
    delete findOptions["group"];
    return await this.MODEL.count(findOptions);
  }
}
