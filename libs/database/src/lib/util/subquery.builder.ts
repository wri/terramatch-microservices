import { Model } from "sequelize-typescript";
import { Attributes, literal, ModelStatic } from "sequelize";
import { isBoolean, isObject } from "lodash";
import { Literal } from "sequelize/types/utils";
import { isNotNull } from "../types/array";
import { User } from "../entities";

export const isLiteral = <T extends Model>(
  values: string | number | Date | boolean | string[] | number[] | Literal | ModelStatic<T>
): values is Literal => isObject(values) && (values as { val: unknown }).val != null;

type AggregateSelection = "MAX";
type SelectOptions<T extends Model> = {
  tableAlias?: string;
  distinct?: boolean;
  aggregate?: { sqlFn: AggregateSelection; groupColumn: keyof Attributes<T>; as?: string };
  additional?: (keyof Attributes<T>)[];
};

export class Subquery<T extends Model> {
  public readonly clauses: ClauseBuilder<T>;

  private constructor(
    public readonly modelStatic: ModelStatic<T>,
    public readonly tableAlias: string
  ) {
    this.clauses = new ClauseBuilder(this);
  }

  public static select<T extends Model>(
    modelStatic: ModelStatic<T>,
    attribute: keyof Attributes<T>,
    options: SelectOptions<T> = {}
  ) {
    return new Subquery(modelStatic, options.tableAlias ?? modelStatic.tableName).select(attribute, options);
  }

  public static clauseBuilder<T extends Model>(modelStatic: ModelStatic<T>, tableAlias?: string) {
    return new Subquery(modelStatic, tableAlias ?? modelStatic.tableName).clauses;
  }

  /**
   * Get a Sequelize literal for a field from a subquery. The default for table alias assumes that
   * the caller is attempting to specify a column on the main query this subquery is being used in,
   * and defaults to the model name.
   */
  public static fieldLiteral<T extends Model>(
    modelStatic: ModelStatic<T>,
    attribute: keyof Attributes<T>,
    tableAlias = modelStatic.name
  ) {
    return literal(new Subquery(modelStatic, tableAlias).field(attribute));
  }

  public static escape(value: string | number | Date) {
    return User.sql.escape(value);
  }

  private select(attribute: keyof Attributes<T>, options: SelectOptions<T> = {}) {
    const select = options.distinct ? "SELECT DISTINCT " : "SELECT ";
    const field =
      options.aggregate == null
        ? this.field(attribute)
        : `${options.aggregate.sqlFn}(${this.field(attribute)}) AS \`${options.aggregate.as ?? "aggregate"}\``;
    const additional =
      options.additional == null ? [] : options.additional.map(col => this.field(col)).filter(isNotNull);
    const fields = [field, ...additional].join(", ");
    const groupColumn = options.aggregate == null ? undefined : this.field(options.aggregate.groupColumn);
    const as = this.tableAlias === this.modelStatic.tableName ? "" : ` AS \`${this.tableAlias}\``;
    return new SubqueryBuilder(this, `${select}${fields} FROM \`${this.modelStatic.tableName}\`${as}`, groupColumn);
  }

  private _attributes: ReturnType<ModelStatic<T>["getAttributes"]>;
  public get attributes() {
    if (this._attributes != null) return this._attributes;

    return (this._attributes = this.modelStatic.getAttributes());
  }

  public get sql() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.modelStatic.sequelize!;
  }

  public field(attr: keyof Attributes<T>) {
    return `\`${this.tableAlias}\`.\`${this.attributes[attr].field}\``;
  }
}

class ClauseBuilder<T extends Model> {
  constructor(private readonly subquery: Subquery<T>) {}

  field(attribute: keyof Attributes<T>) {
    return this.subquery.field(attribute);
  }

  escape(value: string | number | Date | boolean | Literal) {
    return isLiteral(value) ? value.val : isBoolean(value) ? value : this.subquery.sql.escape(value);
  }

  isNull(attribute: keyof Attributes<T>) {
    return `${this.field(attribute)} IS NULL`;
  }

  isNotNull(attribute: keyof Attributes<T>) {
    return `${this.field(attribute)} IS NOT NULL`;
  }

  eq(attribute: keyof Attributes<T>, value: string | number | Date | boolean | Literal) {
    return `${this.field(attribute)} = ${this.escape(value)}`;
  }

  gte(attribute: keyof Attributes<T>, value: string | number | Date) {
    return `${this.field(attribute)} >= ${this.escape(value)}`;
  }

  lt(attribute: keyof Attributes<T>, value: string | number | Date) {
    return `${this.field(attribute)} < ${this.escape(value)}`;
  }

  in(attribute: keyof Attributes<T>, values: string[] | number[] | Literal) {
    const escaped = isLiteral(values) ? values.val : values.map(v => this.escape(v)).join(",");
    return `${this.field(attribute)} IN (${escaped})`;
  }
}

class SubqueryBuilder<T extends Model> {
  private where: string[] = [];
  private joins: string[] = [];

  constructor(
    private readonly subquery: Subquery<T>,
    private readonly selectStatement: string,
    private readonly groupField?: string
  ) {
    if (this.subquery.modelStatic.options.paranoid) {
      this.isNull("deletedAt");
    }
  }

  get sqlString() {
    const joins = this.joins.length == 0 ? "" : ` ${this.joins.join(" ")}`;
    const where = this.where.length == 0 ? "" : `${joins} WHERE ${this.where.join(" AND ")}`;
    if (this.groupField == null) return `(${this.selectStatement}${where})`;

    return `(${this.selectStatement}${where} GROUP BY ${this.groupField})`;
  }

  get literal() {
    return literal(this.sqlString);
  }

  get exists() {
    return literal(`EXISTS (${this.sqlString})`);
  }

  get clauses() {
    return this.subquery.clauses;
  }

  isNull(attribute: keyof Attributes<T>) {
    this.where.push(this.clauses.isNull(attribute));
    return this;
  }

  isNotNull(attribute: keyof Attributes<T>) {
    this.where.push(this.clauses.isNotNull(attribute));
    return this;
  }

  eq(attribute: keyof Attributes<T>, value: string | number | Date | boolean | Literal) {
    this.where.push(this.clauses.eq(attribute, value));
    return this;
  }

  gte(attribute: keyof Attributes<T>, value: string | number | Date) {
    this.where.push(this.clauses.gte(attribute, value));
    return this;
  }

  lt(attribute: keyof Attributes<T>, value: string | number | Date) {
    this.where.push(this.clauses.lt(attribute, value));
    return this;
  }

  in(attribute: keyof Attributes<T>, values: string[] | number[] | Literal) {
    this.where.push(this.clauses.in(attribute, values));
    return this;
  }

  innerJoin<ST extends Model>(select: Literal | ModelStatic<ST>, as: string, on: string) {
    const joinClause = isLiteral(select) ? `(${select.val})` : select.tableName;
    this.joins.push(`INNER JOIN ${joinClause} AS \`${as}\` ON ${on}`);
    return this;
  }

  leftJoin<ST extends Model>(select: Literal | ModelStatic<ST>, as: string, on: string) {
    const joinClause = isLiteral(select) ? `(${select.val})` : select.tableName;
    this.joins.push(`LEFT OUTER JOIN ${joinClause} AS \`${as}\` ON ${on}`);
    return this;
  }

  andLiteral(clause: Literal | string) {
    this.where.push(`${isLiteral(clause) ? clause.val : clause}`);
    return this;
  }
}
