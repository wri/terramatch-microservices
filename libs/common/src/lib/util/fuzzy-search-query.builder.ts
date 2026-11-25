import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, Op, WhereOptions } from "sequelize";
import { combineWheresWithAnd } from "./paginated-query.builder";

export const FUZZY_SEARCH_LIMIT = 10;

/**
 * Builds a "search as you type" query against a single string field on a model. Matches are limited
 * to occurrences of the search term at the beginning of a word in the field, which tends to lead to
 * better results than a simple substring match. Results are ordered with the shortest (closest)
 * matches first.
 */
export class FuzzySearchQueryBuilder<T extends Model> {
  protected findAttributes: (keyof Attributes<T> & string)[] | undefined;
  protected findWhere: WhereOptions<Attributes<T>> = {};

  constructor(
    private readonly MODEL: ModelCtor<T>,
    private readonly field: keyof Attributes<T> & string
  ) {}

  attributes(attributes: (keyof Attributes<T> & string)[]) {
    this.findAttributes = attributes;
    return this;
  }

  /**
   * Adds a condition that every result must meet in addition to matching the search term. Typically
   * used to limit results to the records the current user has access to.
   */
  where(options: WhereOptions<Attributes<T>>) {
    this.findWhere = combineWheresWithAnd(this.findWhere, options);
    return this;
  }

  async execute(search: string) {
    // Use the DB column name so the ordering doesn't depend on the field being included in attributes.
    const column = col(this.MODEL.getAttributes()[this.field].field ?? this.field);
    return await this.MODEL.findAll({
      where: combineWheresWithAnd(this.findWhere, {
        [Op.or]: [{ [this.field]: { [Op.like]: `${search}%` } }, { [this.field]: { [Op.like]: `% ${search}%` } }]
      }),
      attributes: this.findAttributes,
      order: [
        [fn("length", column), "ASC"],
        [column, "ASC"]
      ],
      limit: FUZZY_SEARCH_LIMIT
    });
  }
}
