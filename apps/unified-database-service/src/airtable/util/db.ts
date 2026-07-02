import { ColumnMapping, Include } from "./types";
import { cloneDeep, flatten, isObject, uniq } from "lodash";
import { Model } from "sequelize-typescript";

export const selectAttributes = <T extends Model, A>(columns: ColumnMapping<T, A>[]) =>
  uniq([
    "id",
    ...flatten(
      columns.map(mapping => (isObject(mapping) ? mapping.dbColumn : mapping)).filter(dbColumn => dbColumn != null)
    )
  ]);

/**
 * Merges Includes to arrive at a cohesive set of IncludeOptions for a Sequelize find query.
 */
const mergeInclude = (includes: Include[], include: Include) => {
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
  }

  return includes;
};

export const selectIncludes = <T extends Model, A>(columns: ColumnMapping<T, A>[]) =>
  columns.reduce((includes, mapping) => {
    if (!isObject(mapping)) return includes;
    if (mapping.include == null) return includes;

    return mapping.include.reduce(mergeInclude, includes);
  }, [] as Include[]);
