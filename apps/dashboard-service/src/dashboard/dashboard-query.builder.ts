import { Attributes, Filterable, FindOptions, Includeable, Op, OrderItem, WhereOptions } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { isObject, flatten, isEmpty } from "lodash";
import { Project } from "@terramatch-microservices/database/entities";

export class DashboardProjectsQueryBuilder<T extends Model<T> = Project> {
  protected findOptions: FindOptions<Attributes<T>> = {
    order: ["id"]
  };

  constructor(private readonly MODEL: ModelCtor<T>, include?: Includeable[]) {
    if (include != null && include.length > 0) {
      this.findOptions.include = include;
    }
  }

  order(order: OrderItem) {
    this.findOptions.order = [order];
    return this;
  }

  where(options: WhereOptions, filterable?: Filterable) {
    if (filterable == null) filterable = this.findOptions;
    filterable.where = this.combineWheresWithAnd(filterable.where ?? {}, options);
    return this;
  }

  select(attributes: (keyof Attributes<T>)[]) {
    this.findOptions.attributes = attributes as string[];
    return this;
  }

  queryFilters(filters: DashboardQueryDto) {
    const where: WhereOptions = {
      status: "approved",
      frameworkKey: { [Op.in]: ["terrafund", "terrafund-landscapes", "enterprises"] },
      cohort: { [Op.in]: ["terrafund", "terrafund-landscapes"] }
    };
    const organisationWhere: WhereOptions = {
      type: { [Op.in]: ["non-profit-organization", "for-profit-organization"] }
    };

    if (!isEmpty(filters?.country)) where["country"] = filters.country;
    if (!isEmpty(filters?.programmes)) where["frameworkKey"] = { [Op.in]: [filters.programmes] };
    if (!isEmpty(filters?.cohort)) where["cohort"] = filters.cohort;
    if (!isEmpty(filters?.landscapes)) where["landscape"] = { [Op.in]: [filters.landscapes] };
    if (!isEmpty(filters?.organisationType)) organisationWhere["type"] = { [Op.in]: [filters.organisationType] };
    if (!isEmpty(filters?.projectUuid))
      where["uuid"] = Array.isArray(filters.projectUuid) ? { [Op.in]: filters.projectUuid } : filters.projectUuid;

    this.where(where);

    this.findOptions.include = [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"],
        where: organisationWhere
      }
    ];

    return this;
  }

  async execute() {
    return await this.MODEL.findAll(this.findOptions);
  }

  async count() {
    return await this.MODEL.count({
      ...this.findOptions,
      distinct: true,
      col: "id"
    });
  }

  async sum(field: keyof Attributes<T>) {
    return await this.MODEL.sum(field, this.findOptions);
  }

  async pluckIds(): Promise<number[]> {
    const results = await this.MODEL.findAll({
      ...this.findOptions,
      attributes: ["id"],
      raw: true
    });

    return results.map(r => r.id);
  }

  private operatorSet = new Set(Object.values(Op));

  private getComplexKeys(obj: object) {
    const symbols = Object.getOwnPropertySymbols(obj).filter(s => this.operatorSet.has(s)) as (symbol | string)[];
    return symbols.concat(Object.keys(obj));
  }

  private unpackAnd(where: WhereOptions) {
    if (!isObject(where)) return where;

    const keys = this.getComplexKeys(where);
    if (keys.length === 0) return;
    if (keys.length !== 1 || keys[0] !== Op.and) return where;
    return where[Op.and];
  }

  private combineWheresWithAnd(whereA: WhereOptions, whereB: WhereOptions): WhereOptions {
    const unpackedA = this.unpackAnd(whereA);
    if (unpackedA === undefined) return whereB;
    const unpackedB = this.unpackAnd(whereB);
    if (unpackedB === undefined) return whereA;
    return { [Op.and]: flatten([unpackedA, unpackedB]) };
  }
}
