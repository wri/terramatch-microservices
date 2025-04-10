import { Model } from "sequelize-typescript";
import { Attributes, literal, ModelStatic } from "sequelize";
import { isBoolean, isObject } from "lodash";
import { Literal } from "sequelize/types/utils";

const isLiteral = (values: string[] | number[] | Literal): values is Literal =>
  isObject(values) && (values as { val: unknown }).val != null;

type SelectOptions = {
  distinct?: boolean;
};

export class Subquery<T extends Model<T>> {
  private constructor(public readonly modelStatic: ModelStatic<T>) {}

  public static select<T extends Model<T>>(
    modelStatic: ModelStatic<T>,
    attribute: keyof Attributes<T>,
    options: SelectOptions = {}
  ) {
    return new Subquery(modelStatic).select(attribute, options);
  }

  private select(attribute: keyof Attributes<T>, options: SelectOptions = {}) {
    if (options.distinct) {
      return new SubqueryBuilder(this, `SELECT DISTINCT ${this.field(attribute)} FROM ${this.modelStatic.tableName}`);
    }

    return new SubqueryBuilder(this, `SELECT ${this.field(attribute)} FROM ${this.modelStatic.tableName}`);
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
    return this.attributes[attr].field;
  }
}

class SubqueryBuilder<T extends Model<T>> {
  private where: string[] = [];

  constructor(private readonly subquery: Subquery<T>, private readonly selectStatement: string) {
    if (this.subquery.modelStatic.options.paranoid) {
      this.isNull("deletedAt");
    }
  }

  get literal() {
    const where = this.where.length == 0 ? "" : ` WHERE ${this.where.join(" AND ")}`;
    return literal(`(${this.selectStatement}${where})`);
  }

  isNull(attribute: keyof Attributes<T>) {
    this.where.push(`${this.subquery.field(attribute)} IS NULL`);
    return this;
  }

  eq(attribute: keyof Attributes<T>, value: string | number | Date | boolean) {
    const escaped = isBoolean(value) ? value : this.subquery.sql.escape(value);
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
}
