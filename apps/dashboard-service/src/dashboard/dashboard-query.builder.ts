import { Attributes, Filterable, FindOptions, Includeable, Op, OrderItem, WhereOptions, Sequelize } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { isObject, flatten, isEmpty } from "lodash";
import { Project } from "@terramatch-microservices/database/entities";
import { mapLandscapeCodesToNames } from "@terramatch-microservices/database/constants";
import { InternalServerErrorException } from "@nestjs/common";

export class DashboardProjectsQueryBuilder<T extends Model<T> = Project> {
  protected findOptions: FindOptions<Attributes<T>> = {
    order: ["id"]
  };

  constructor(private readonly MODEL: ModelCtor<T>, include?: Includeable[]) {
    if (include != null && include.length > 0) {
      this.findOptions.include = include;
    }
  }

  get sql() {
    if (this.MODEL.sequelize == null) throw new InternalServerErrorException("Model is missing sequelize connection");
    return this.MODEL.sequelize;
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

  async select(attributes: (keyof Attributes<T>)[]) {
    return await this.MODEL.findAll({
      ...this.findOptions,
      attributes: attributes as string[]
    });
  }

  queryFilters(filters: DashboardQueryDto) {
    const where: WhereOptions = {
      status: "approved",
      frameworkKey: { [Op.in]: ["terrafund", "terrafund-landscapes", "enterprises"] }
    };
    const organisationWhere: WhereOptions = {
      type: { [Op.in]: ["non-profit-organization", "for-profit-organization"] }
    };

    if (!isEmpty(filters?.country)) where["country"] = filters.country;
    if (!isEmpty(filters?.programmes)) where["frameworkKey"] = { [Op.in]: [filters.programmes] };
    if (filters?.landscapes != null && filters.landscapes.length > 0) {
      const landscapeNames = mapLandscapeCodesToNames(filters.landscapes);
      where["landscape"] = { [Op.in]: landscapeNames };
    }
    if (!isEmpty(filters?.organisationType)) organisationWhere["type"] = { [Op.in]: [filters.organisationType] };
    if (!isEmpty(filters?.projectUuid))
      where["uuid"] = Array.isArray(filters.projectUuid) ? { [Op.in]: filters.projectUuid } : filters.projectUuid;

    this.where(where);

    if (filters?.cohort != null && filters.cohort.length > 0) {
      const cohortConditions = filters.cohort
        .map(cohort => {
          const escapedCohort = this.sql.escape(`"${cohort}"`);
          return `JSON_CONTAINS(cohort, ${escapedCohort})`;
        })
        .join(" OR ");
      this.where(Sequelize.literal(`(${cohortConditions})`));
    } else {
      const defaultCohorts = ["terrafund", "terrafund-landscapes"];
      const defaultCohortConditions = defaultCohorts
        .map(cohort => {
          const escapedCohort = this.sql.escape(`"${cohort}"`);
          return `JSON_CONTAINS(cohort, ${escapedCohort})`;
        })
        .join(" OR ");
      this.where(Sequelize.literal(`(${defaultCohortConditions})`));
    }

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
