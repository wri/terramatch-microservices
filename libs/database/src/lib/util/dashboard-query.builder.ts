import { Attributes, Filterable, FindOptions, Includeable, Op, OrderItem, WhereOptions } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";
import { combineWheresWithAnd } from "./paginated-query.builder";
import { DashboardQueryDto } from "../../../../../apps/dashboard-service/src/dashboard/dto/dashboard-query.dto";
import { Project } from "../entities";

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
    filterable.where = combineWheresWithAnd(filterable.where ?? {}, options);
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

    if (filters?.organisationType) {
      organisationWhere["type"] = { [Op.in]: [filters.organisationType] };
    }

    if (filters?.country) where["country"] = filters.country;
    if (filters?.programmes) where["frameworkKey"] = { [Op.in]: [filters.programmes] };
    if (filters?.cohort) where["cohort"] = filters.cohort;
    if (filters?.landscapes) where["landscape"] = { [Op.in]: [filters.landscapes] };
    if (filters?.organisationType) organisationWhere["type"] = { [Op.in]: [filters.organisationType] };
    if (filters?.projectUuid)
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
}
