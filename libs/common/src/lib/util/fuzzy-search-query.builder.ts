import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, col, fn, Op, WhereOptions } from "sequelize";
import { combineWheresWithAnd } from "./paginated-query.builder";

export const FUZZY_SEARCH_LIMIT = 10;

/** Escapes LIKE wildcards so the user's text is matched literally. */
export const escapeLikeTerm = (term: string) => term.replace(/[\\%_]/g, "\\$&");

/**
 * Builds a "search as you type" query against a single string field on a model. By default matches are
 * limited to occurrences of the search term at the beginning of a word in the field. Call `matchAnywhere()`
 * to match the term anywhere in the field, the same way the index searches do. Results are ordered with the
 * shortest (closest) matches first.
 */
export class FuzzySearchQueryBuilder<T extends Model> {
  protected findAttributes: (keyof Attributes<T> & string)[] | undefined;
  protected findWhere: WhereOptions<Attributes<T>> = {};
  protected anywhere = false;

  constructor(
    private readonly MODEL: ModelCtor<T>,
    private readonly field: keyof Attributes<T> & string
  ) {}

  attributes(attributes: (keyof Attributes<T> & string)[]) {
    this.findAttributes = attributes;
    return this;
  }

  /** Matches the search term anywhere in the field, not only at the beginning of a word. */
  matchAnywhere() {
    this.anywhere = true;
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
    const term = escapeLikeTerm(search);
    const matches = this.anywhere
      ? [{ [this.field]: { [Op.like]: `%${term}%` } }]
      : [{ [this.field]: { [Op.like]: `${term}%` } }, { [this.field]: { [Op.like]: `% ${term}%` } }];
    return await this.MODEL.findAll({
      where: combineWheresWithAnd(this.findWhere, { [Op.or]: matches }),
      attributes: this.findAttributes,
      order: [
        [fn("length", column), "ASC"],
        [column, "ASC"]
      ],
      limit: FUZZY_SEARCH_LIMIT
    });
  }
}
