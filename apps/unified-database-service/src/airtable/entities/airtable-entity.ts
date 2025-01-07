import { Model, ModelType } from "sequelize-typescript";
import { cloneDeep, isArray, isObject, uniq } from "lodash";
import { Attributes, FindOptions } from "sequelize";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { LoggerService } from "@nestjs/common";
import Airtable from "airtable";

// The Airtable API only supports bulk updates of up to 10 rows.
const AIRTABLE_PAGE_SIZE = 10;

export abstract class AirtableEntity<ModelType extends Model<ModelType>, AssociationType = Record<string, never>> {
  abstract readonly TABLE_NAME: string;
  abstract readonly COLUMNS: ColumnMapping<ModelType, AssociationType>[];
  abstract readonly MODEL: { findAll: (options: FindOptions<ModelType>) => Promise<ModelType[]> };

  private readonly logger: LoggerService = new TMLogService(AirtableEntity.name);

  /**
   * If an airtable entity provides a concrete type for Associations, this method should be overridden
   * to execute the necessary DB queries and provide a mapping of record number to concrete instance
   * of the association type.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async loadAssociations(entities: ModelType[]): Promise<Record<number, AssociationType>> {
    // The default implementation returns an empty mapping.
    return {};
  }

  async updateBase(base: Airtable.Base) {
    for (let page = 0; await this.processPage(base, page); page++) {
      this.logger.log(`Processed page: ${JSON.stringify({ table: this.TABLE_NAME, page })}`);
      // TODO testing; do not merge with this break
      // break;
    }
  }

  private async processPage(base: Airtable.Base, page: number) {
    let airtableRecords: { fields: object }[];
    try {
      const records = await this.MODEL.findAll({
        attributes: selectAttributes(this.COLUMNS),
        include: selectIncludes(this.COLUMNS),
        limit: AIRTABLE_PAGE_SIZE,
        offset: page * AIRTABLE_PAGE_SIZE
      } as FindOptions<ModelType>);

      // Page had no records, halt processing.
      if (records.length === 0) return false;

      const associations = await this.loadAssociations(records);

      airtableRecords = await Promise.all(
        records.map(async record => ({ fields: await mapEntityColumns(record, associations[record.id], this.COLUMNS) }))
      );
    } catch (error) {
      this.logger.error("Airtable mapping failed", error.stack);
      throw error;
    }

    try {
      // TODO: testing, do not merge with this console log
      // console.log("records", airtableRecords);

      // @ts-expect-error The types for this lib haven't caught up with its support for upserts
      // https://github.com/Airtable/airtable.js/issues/348
      await base(this.TABLE_NAME).update(airtableRecords, {
        performUpsert: { fieldsToMergeOn: ["uuid"] },
        // Enables new multi/single selection options to be populated by this upsert.
        typecast: true
      });
    } catch (error) {
      this.logger.error(
        `Entity update failed: ${JSON.stringify({ entity: this.TABLE_NAME, error, airtableRecords }, null, 2)}`
      );
      throw error;
    }

    // True signals that processing succeeded and the next page should begin
    return true;
  }
}

export type MergeableInclude = {
  model?: ModelType<unknown, unknown>;
  association?: string;
  attributes?: string[];
  include?: MergeableInclude[];
};

/**
 * A ColumnMapping is either a tuple of [dbColumn, airtableColumn], or a more descriptive object
 */
export type ColumnMapping<T extends Model<T>, A = Record<string, never>> =
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

const selectAttributes = <T extends Model<T>, A>(columns: ColumnMapping<T, A>[]) =>
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

const selectIncludes = <T extends Model<T>, A>(columns: ColumnMapping<T, A>[]) =>
  columns.reduce((includes, mapping) => {
    if (isArray(mapping) || !isObject(mapping)) return includes;
    if (mapping.include == null) return includes;

    return mapping.include.reduce(mergeInclude, includes);
  }, [] as MergeableInclude[]);

const mapEntityColumns = async <T extends Model<T>, A>(entity: T, associations: A, columns: ColumnMapping<T, A>[]) => {
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

/**
 * Used with Array.reduce to produce a map of parent record id => array of associated records
 */
export const associationReducer =
  <E, K extends string | number = number>(foreignKey: string) =>
  (byParentRecord: Record<K, E[]>, entity: E) => {
    if (byParentRecord[entity[foreignKey]] == null) {
      byParentRecord[entity[foreignKey]] = [];
    }
    byParentRecord[entity[foreignKey]].push(entity);
    return byParentRecord;
  };
