import { Model, ModelCtor, ModelType } from "sequelize-typescript";
import { cloneDeep, flatten, groupBy, isEmpty, isObject, isString, keyBy, mapValues, merge, uniq } from "lodash";
import { Attributes, FindOptions, Op, WhereOptions } from "sequelize";
import Airtable from "airtable";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Dictionary } from "factory-girl-ts";

// The Airtable API only supports bulk updates of up to 10 rows.
const AIRTABLE_PAGE_SIZE = 10;

type UpdateBaseOptions = { startPage?: number; updatedSince?: Date };

// Limit in Airtable
const LONG_TEXT_MAX_LENGTH = 100000;

export abstract class AirtableEntity<ModelType extends Model, AssociationType = Record<string, never>> {
  abstract readonly TABLE_NAME: string;
  abstract readonly COLUMNS: ColumnMapping<ModelType, AssociationType>[];
  abstract readonly MODEL: ModelCtor<ModelType>;
  readonly IDENTITY_COLUMN: string = "uuid";
  readonly SUPPORTS_UPDATED_SINCE: boolean = true;
  readonly FILTER_FLAGS: string[] = [];

  protected readonly logger = new TMLogger(AirtableEntity.name);

  constructor(protected dataApi: DataApiService) {}

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

  async updateBase(base: Airtable.Base, { startPage, updatedSince }: UpdateBaseOptions = {}) {
    // Get any find options that might have been provided by a subclass to issue this query
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { offset, limit, attributes, include, ...countOptions } = this.getUpdatePageFindOptions(0, updatedSince);
    const count = await this.MODEL.count(countOptions);
    if (count === 0) {
      this.logger.log(`No updates to process, skipping: ${JSON.stringify({ table: this.TABLE_NAME, updatedSince })}`);
      return;
    }

    const expectedPages = Math.floor(count / AIRTABLE_PAGE_SIZE);
    for (let page = startPage ?? 0; await this.processUpdatePage(base, page, updatedSince); page++) {
      this.logger.log(`Processed update page: ${JSON.stringify({ table: this.TABLE_NAME, page, expectedPages })}`);
    }
  }

  async deleteStaleRecords(base: Airtable.Base, deletedSince: Date) {
    // Use the delete page find options except limit and offset to get an accurate count
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { offset, limit, attributes, ...countOptions } = this.getDeletePageFindOptions(deletedSince, 0);
    const count = await this.MODEL.count(countOptions);
    if (count === 0) {
      this.logger.log(`No deletes to process, skipping: ${JSON.stringify({ table: this.TABLE_NAME, deletedSince })})`);
      return;
    }

    const expectedPages = Math.floor(count / AIRTABLE_PAGE_SIZE);
    for (let page = 0; await this.processDeletePage(base, deletedSince, page); page++) {
      this.logger.log(`Processed delete page: ${JSON.stringify({ table: this.TABLE_NAME, page, expectedPages })}`);
    }
  }

  protected getUpdatePageFindOptions(page: number, updatedSince?: Date) {
    const where = {} as WhereOptions<ModelType>;

    if (this.SUPPORTS_UPDATED_SINCE && updatedSince != null) {
      where["updatedAt"] = { [Op.gte]: updatedSince };
    }
    if (!isEmpty(this.FILTER_FLAGS)) {
      for (const flag of this.FILTER_FLAGS) {
        where[flag] = false;
      }
    }

    return {
      attributes: selectAttributes(this.COLUMNS),
      include: selectIncludes(this.COLUMNS),
      order: ["id"],
      limit: AIRTABLE_PAGE_SIZE,
      offset: page * AIRTABLE_PAGE_SIZE,
      where
    } as FindOptions<ModelType>;
  }

  protected getDeletePageFindOptions(deletedSince: Date, page: number) {
    const where = {} as WhereOptions<ModelType>;

    const deletedAtCondition = { [Op.gte]: deletedSince };
    if (isEmpty(this.FILTER_FLAGS)) {
      where["deletedAt"] = deletedAtCondition;
    } else {
      where[Op.or] = {
        deletedAt: deletedAtCondition,
        // include records that have been hidden since the timestamp as well
        [Op.and]: {
          updatedAt: { ...deletedAtCondition },
          [Op.or]: this.FILTER_FLAGS.reduce((flags, flag) => ({ ...flags, [flag]: true }), {})
        }
      };
    }

    return {
      attributes: [this.IDENTITY_COLUMN],
      paranoid: false,
      order: ["id"],
      limit: AIRTABLE_PAGE_SIZE,
      offset: page * AIRTABLE_PAGE_SIZE,
      where
    } as FindOptions<ModelType>;
  }

  private async processUpdatePage(base: Airtable.Base, page: number, updatedSince?: Date) {
    let airtableRecords: { fields: object }[];
    try {
      const records = await this.MODEL.findAll(this.getUpdatePageFindOptions(page, updatedSince));

      // Page had no records, halt processing.
      if (records.length === 0) return false;

      const associations = await this.loadAssociations(records);

      airtableRecords = await Promise.all(
        records.map(async record => ({ fields: await this.mapEntityColumns(record, associations[record.id]) }))
      );
    } catch (error) {
      this.logger.error(`Airtable mapping failed: ${JSON.stringify({ entity: this.TABLE_NAME, page })}`, error.stack);
      throw error;
    }

    try {
      // @ts-expect-error The types for this lib haven't caught up with its support for upserts
      // https://github.com/Airtable/airtable.js/issues/348
      await base(this.TABLE_NAME).update(airtableRecords, {
        performUpsert: { fieldsToMergeOn: [this.IDENTITY_COLUMN] },
        // Enables new multi/single selection options to be populated by this upsert.
        typecast: true
      });
    } catch (error) {
      this.logger.error(
        `Entity update failed: ${JSON.stringify({ entity: this.TABLE_NAME, page, airtableRecords }, null, 2)}`,
        error.stack
      );
      throw error;
    }

    // True signals that processing succeeded and the next page should begin
    return true;
  }

  private async processDeletePage(base: Airtable.Base, deletedSince: Date, page: number) {
    let idMapping: Record<string, string>;

    try {
      const records = (await this.MODEL.findAll(
        this.getDeletePageFindOptions(deletedSince, page)
      )) as unknown as UuidModel[];

      // Page had no records, halt processing.
      if (records.length === 0) return false;

      const formula = `OR(${records
        .map(record => `{${this.IDENTITY_COLUMN}}='${record[this.IDENTITY_COLUMN]}'`)
        .join(",")})`;
      const result = await base(this.TABLE_NAME)
        .select({ filterByFormula: formula, fields: [this.IDENTITY_COLUMN] })
        .firstPage();

      idMapping = result.reduce(
        (idMapping, { id, fields }) => ({
          ...idMapping,
          [id]: fields[this.IDENTITY_COLUMN]
        }),
        {}
      );
    } catch (error) {
      this.logger.error(
        `Fetching Airtable records failed: ${JSON.stringify({ entity: this.TABLE_NAME, page })}`,
        error.stack
      );
      throw error;
    }

    const recordIds = Object.keys(idMapping);
    // None of these records in our DB currently exist on AirTable. On to the next page.
    if (recordIds.length == 0) return true;

    try {
      await base(this.TABLE_NAME).destroy(recordIds);
      this.logger.log(`Deleted records from Airtable: ${JSON.stringify({ entity: this.TABLE_NAME, idMapping })}`);
    } catch (error) {
      this.logger.error(
        `Airtable record delete failed: ${JSON.stringify({ entity: this.TABLE_NAME, page, idMapping })}`,
        error.stack
      );
      throw error;
    }

    // True signals that processing succeeded and the next page should begin
    return true;
  }

  protected async mapEntityColumns(record: ModelType, associations: AssociationType) {
    const airtableObject = {};
    for (const mapping of this.COLUMNS) {
      let value = isObject(mapping) ? await mapping.valueMap(record, associations) : record[mapping];
      if (isString(value) && value.length > LONG_TEXT_MAX_LENGTH) {
        value = value.substring(0, LONG_TEXT_MAX_LENGTH - 3) + "...";
      }
      airtableObject[airtableColumnName(mapping)] = value;
    }

    return airtableObject;
  }

  protected async loadPolymorphicUuidAssociations(
    typeMappings: Record<string, PolymorphicUuidAssociation<AssociationType>>,
    typeColumn: keyof Attributes<ModelType>,
    idColumn: keyof Attributes<ModelType>,
    entities: ModelType[]
  ) {
    const byType = groupBy(entities, typeColumn);
    const associations = {} as Record<number, AssociationType>;

    // This loop takes the polymorphic types that have been grouped from this set of entities, queries
    // the appropriate models to find their UUIDs, and then associates that UUID with the correct
    // member of the association type for that entity. Each entity will only have one of these
    // UUIDs set.
    for (const type of Object.keys(byType)) {
      if (typeMappings[type] == null) {
        this.logger.error(`${String(typeColumn)} not recognized, ignoring [${type}]`);
        continue;
      }

      const { model, association } = typeMappings[type];
      const entitiesForType = byType[type];
      const ids = uniq(entitiesForType.map(entity => entity[idColumn])) as number[];
      const models = await model.findAll({ where: { id: ids }, attributes: ["id", "uuid"] });
      for (const entity of entitiesForType) {
        const { uuid } = (models.find(({ id }) => id === entity[idColumn]) as unknown as { uuid: string }) ?? {};
        associations[entity.id as number] = { [association]: uuid } as AssociationType;
      }
    }

    return associations;
  }

  protected _gadmLevel0Names: Dictionary<string>;
  protected async gadmLevel0Names() {
    return (this._gadmLevel0Names ??= mapValues(keyBy(await this.dataApi.gadmLevel0(), "iso"), "name"));
  }

  protected _gadmLevel1Names: Dictionary<Dictionary<string>> = {};
  protected async gadmLevel1Names(level0Codes: string[]) {
    return merge(
      {},
      ...(await Promise.all(
        level0Codes.map(async code => {
          return (this._gadmLevel1Names[code] ??= mapValues(keyBy(await this.dataApi.gadmLevel1(code), "id"), "name"));
        })
      ))
    );
  }

  protected _gadmLevel2Names: Dictionary<Dictionary<string>> = {};
  protected async gadmLevel2Names(level1Codes: string[]) {
    return merge(
      {},
      ...(await Promise.all(
        level1Codes.map(async code => {
          return (this._gadmLevel2Names[code] ??= mapValues(keyBy(await this.dataApi.gadmLevel2(code), "id"), "name"));
        })
      ))
    );
  }
}

export type Include = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model?: ModelType<any, any>;
  association?: string;
  attributes?: string[];
};

type AirtableValue = null | undefined | string | number | boolean | Date | string[];

/**
 * A ColumnMapping is either a string (airtableColumn and dbColumn are the same), or a more descriptive object
 */
export type ColumnMapping<T extends Model, A = Record<string, never>> =
  | keyof Attributes<T>
  | {
      airtableColumn: string;
      // Include if this mapping should include a particular DB column in the DB query
      dbColumn?: keyof Attributes<T> | (keyof Attributes<T>)[];
      // Include if this mapping should eager load an association on the DB query
      include?: Include[];
      valueMap: (entity: T, associations: A) => Promise<AirtableValue>;
    };

export type PolymorphicUuidAssociation<AssociationType> = {
  model: ModelCtor;
  association: keyof AssociationType;
};

// used in the test suite
export const airtableColumnName = <T extends Model>(mapping: ColumnMapping<T, unknown>) =>
  isObject(mapping) ? mapping.airtableColumn : (mapping as string);

const selectAttributes = <T extends Model, A>(columns: ColumnMapping<T, A>[]) =>
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

const selectIncludes = <T extends Model, A>(columns: ColumnMapping<T, A>[]) =>
  columns.reduce((includes, mapping) => {
    if (!isObject(mapping)) return includes;
    if (mapping.include == null) return includes;

    return mapping.include.reduce(mergeInclude, includes);
  }, [] as Include[]);

export const commonEntityColumns = <T extends UuidModel, A = Record<string, never>>(adminSiteType?: string) =>
  [
    "uuid",
    "createdAt",
    "updatedAt",
    ...(adminSiteType == null
      ? []
      : [
          {
            airtableColumn: "linkToTerramatch",
            dbColumn: "uuid",
            valueMap: ({ uuid }) => `https://www.terramatch.org/admin#/${adminSiteType}/${uuid}/show`
          }
        ])
  ] as ColumnMapping<T, A>[];

export const associatedValueColumn = <T extends Model, A>(
  valueName: keyof A,
  dbColumn?: keyof Attributes<T> | (keyof Attributes<T>)[]
): ColumnMapping<T, A> => ({
  airtableColumn: valueName as string,
  dbColumn,
  valueMap: async (_, associations: A) => associations?.[valueName] as AirtableValue
});

export const percentageColumn = <T extends Model, A = Record<string, never>>(
  dbColumn: keyof Attributes<T>
): ColumnMapping<T, A> => ({
  airtableColumn: dbColumn as string,
  dbColumn,
  valueMap: async model => ((model[dbColumn] as number | null) ?? 0) / 100
});
