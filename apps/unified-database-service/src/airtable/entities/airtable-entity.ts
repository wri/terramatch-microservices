import { Model, ModelType } from "sequelize-typescript";
import { cloneDeep, isArray, isObject, uniq } from "lodash";
import { Attributes } from "sequelize";

export type AirtableEntity<T extends Model<T>, A> = {
  TABLE_NAME: string;
  UUID_COLUMN: string;
  mapDbEntity: (entity: T, associations: A) => Promise<object>;
  findMany: (pageSize: number, offset: number) => Promise<T[]>;
  loadAssociations: (entities: T[]) => Promise<Record<number, A>>;
};

export type MergeableInclude = {
  model?: ModelType<unknown, unknown>;
  association?: string;
  attributes?: string[];
  include?: MergeableInclude[];
};

/**
 * A ColumnMapping is either a tuple of [dbColumn, airtableColumn], or a more descriptive object
 */
export type ColumnMapping<T extends Model<T>, A> =
  | keyof Attributes<T>
  | [keyof Attributes<T>, string]
  | {
      airtableColumn: string;
      // Include if this mapping should include a particular DB column in the DB query
      dbColumn?: keyof Attributes<T>;
      // Include if this mapping should eager load an association on the DB query
      include?: MergeableInclude[];
      valueMap: (entity: T, associations: A) => Promise<null | string | number | boolean | Date>;
    };

export const selectAttributes = <T extends Model<T>, A>(columns: ColumnMapping<T, A>[]) =>
  uniq([
    "id",
    ...columns
      .map(mapping => (isArray(mapping) ? mapping[0] : isObject(mapping) ? mapping.dbColumn : mapping))
      .filter(dbColumn => dbColumn != null)
  ]);

/**
 * Recursively merges MergeableIncludes to arrive at a cohesive set of IncludeOptions for a Sequelize find
 * query.
 */
const mergeInclude = (includes: MergeableInclude[], include: MergeableInclude) => {
  const existing = includes.find(
    ({ model, association }) =>
      (model != null && model === include.model) || (association != null && association === include.association)
  );
  if (existing == null) {
    // Use clone deep here so that if this include gets modified in the future, it doesn't mutate the
    // original definition.
    includes.push(cloneDeep(include));
  } else {
    if (existing.attributes != null) {
      // If either the current include or the new mapping is missing an attributes array, we want
      // to make sure the final include is missing it as well so that all columns are pulled.
      if (include.attributes == null) {
        delete include.attributes;
      } else {
        // We don't need cloneDeep here because attributes is a simple string array.
        existing.attributes = uniq([...existing.attributes, ...include.attributes]);
      }
    }

    if (include.include != null) {
      // Use clone deep here so that if this include gets modified in the future, it doesn't mutate the
      // original definition.
      if (existing.include == null) existing.include = cloneDeep(include.include);
      else {
        existing.include = include.include.reduce(mergeInclude, existing.include);
      }
    }
  }

  return includes;
};

export const selectIncludes = <T extends Model<T>, A>(columns: ColumnMapping<T, A>[]) =>
  columns.reduce((includes, mapping) => {
    if (isArray(mapping) || !isObject(mapping)) return includes;
    if (mapping.include == null) return includes;

    return mapping.include.reduce(mergeInclude, includes);
  }, [] as MergeableInclude[]);

export const mapEntityColumns = async <T extends Model<T>, A>(
  entity: T,
  associations: A,
  columns: ColumnMapping<T, A>[]
) => {
  const airtableObject = {};
  for (const mapping of columns) {
    const airtableColumn = isArray(mapping)
      ? mapping[1]
      : isObject(mapping)
      ? mapping.airtableColumn
      : (mapping as string);
    airtableObject[airtableColumn] = isArray(mapping)
      ? entity[mapping[0]]
      : isObject(mapping)
      ? await mapping.valueMap(entity, associations)
      : entity[mapping];
  }

  return airtableObject;
};
