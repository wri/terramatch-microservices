import { Model } from "sequelize-typescript";
import { Attributes, literal, ModelStatic } from "sequelize";
import { isBoolean, isObject } from "lodash";
import { Literal } from "sequelize/types/utils";
import { isNotNull } from "../types/array";

const isLiteral = (values: string | number | Date | boolean | string[] | number[] | Literal): values is Literal =>
  isObject(values) && (values as { val: unknown }).val != null;

type AggregateSelection = "MAX";
type SelectOptions<T extends Model> = {
  tableAlias?: string;
  distinct?: boolean;
  aggregate?: { sqlFn: AggregateSelection; groupColumn: keyof Attributes<T>; as?: string };
  additional?: (keyof Attributes<T>)[];
};

export class Subquery<T extends Model> {
  private constructor(public readonly modelStatic: ModelStatic<T>, public readonly tableAlias: string) {}

  public static select<T extends Model>(
    modelStatic: ModelStatic<T>,
    attribute: keyof Attributes<T>,
    options: SelectOptions<T> = {}
  ) {
    return new Subquery(modelStatic, options.tableAlias ?? modelStatic.tableName).select(attribute, options);
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

  isNull(attribute: keyof Attributes<T>) {
    this.where.push(`${this.subquery.field(attribute)} IS NULL`);
    return this;
  }

  isNotNull(attribute: keyof Attributes<T>) {
    this.where.push(`${this.subquery.field(attribute)} IS NOT NULL`);
    return this;
  }

  eq(attribute: keyof Attributes<T>, value: string | number | Date | boolean | Literal) {
    const escaped = isLiteral(value) ? value.val : isBoolean(value) ? value : this.subquery.sql.escape(value);
    this.where.push(`${this.subquery.field(attribute)} = ${escaped}`);
    return this;
  }

  gte(attribute: keyof Attributes<T>, value: string | number | Date) {
    this.where.push(`${this.subquery.field(attribute)} >= ${this.subquery.sql.escape(value)}`);
    return this;
  }

  lt(attribute: keyof Attributes<T>, value: string | number | Date) {
    this.where.push(`${this.subquery.field(attribute)} < ${this.subquery.sql.escape(value)}`);
    return this;
  }

  in(attribute: keyof Attributes<T>, values: string[] | number[] | Literal) {
    const escaped = isLiteral(values) ? values.val : values.map(v => this.subquery.sql.escape(v)).join(",");
    this.where.push(`${this.subquery.field(attribute)} IN (${escaped})`);
    return this;
  }

  innerJoin(select: Literal, as: string, on: string) {
    this.joins.push(`INNER JOIN (${select.val}) AS \`${as}\` ON ${on}`);
    return this;
  }
}
