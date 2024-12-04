import { Model } from "sequelize-typescript";
import { isArray } from "lodash";
import { Attributes } from "sequelize";

export type AirtableEntity<T extends Model<T>> = {
  TABLE_NAME: string;
  UUID_COLUMN: string;
  mapDbEntity: (entity: T) => Promise<object>;
  findOne: (uuid: string) => Promise<T>;
};

/**
 * A ColumnMapping is either a tuple of [dbColumn, airtableColumn], or a more descriptive object
 */
export type ColumnMapping<T extends Model<T>> =
  | [keyof Attributes<T>, string]
  | {
      airtableColumn: string;
      dbColumn?: keyof Attributes<T>;
      valueMap: (entity: T) => Promise<null | string | number | boolean | Date>;
    };

export const selectAttributes = <T extends Model<T>>(columns: ColumnMapping<T>[]) =>
  columns.map(mapping => (isArray(mapping) ? mapping[0] : mapping.dbColumn)).filter(dbColumn => dbColumn != null);

export const mapEntityColumns = async <T extends Model<T>>(entity: T, columns: ColumnMapping<T>[]) => {
  const airtableObject = {};
  for (const mapping of columns) {
    const airtableColumn = isArray(mapping) ? mapping[1] : mapping.airtableColumn;
    airtableObject[airtableColumn] = isArray(mapping) ? entity[mapping[0]] : await mapping.valueMap(entity);
  }

  return airtableObject;
};
