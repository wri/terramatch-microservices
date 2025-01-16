import { Model, ModelCtor, ModelType } from "sequelize-typescript";
import { cloneDeep, flatten, isObject, uniq } from "lodash";
import { Attributes, FindOptions, Op } from "sequelize";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { LoggerService } from "@nestjs/common";
import Airtable from "airtable";

// The Airtable API only supports bulk updates of up to 10 rows.
const AIRTABLE_PAGE_SIZE = 10;

type UpdateBaseOptions = { startPage?: number; updatedSince?: Date };

export abstract class AirtableEntity<ModelType extends Model<ModelType>, AssociationType = Record<string, never>> {
  abstract readonly TABLE_NAME: string;
  abstract readonly COLUMNS: ColumnMapping<ModelType, AssociationType>[];
  abstract readonly MODEL: ModelCtor<ModelType>;

  protected readonly logger: LoggerService = new TMLogService(AirtableEntity.name);

  protected get supportsUpdatedSince() {
    return true;
  }

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
    return {
      attributes: selectAttributes(this.COLUMNS),
      include: selectIncludes(this.COLUMNS),
      limit: AIRTABLE_PAGE_SIZE,
      offset: page * AIRTABLE_PAGE_SIZE,
      where: {
        ...(this.supportsUpdatedSince && updatedSince != null ? { updatedAt: { [Op.gte]: updatedSince } } : null)
      }
    } as FindOptions<ModelType>;
  }

  protected getDeletePageFindOptions(deletedSince: Date, page: number) {
    return {
      attributes: ["uuid"],
      paranoid: false,
      where: { deletedAt: { [Op.gte]: deletedSince } },
      limit: AIRTABLE_PAGE_SIZE,
      offset: page * AIRTABLE_PAGE_SIZE
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
        performUpsert: { fieldsToMergeOn: ["uuid"] },
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
      )) as unknown as UuidModel<ModelType>[];

      // Page had no records, halt processing.
      if (records.length === 0) return false;

      const formula = `OR(${records.map(({ uuid }) => `{uuid}='${uuid}'`).join(",")})`;
      const result = await base(this.TABLE_NAME)
        .select({ filterByFormula: formula, fields: ["uuid"] })
        .firstPage();

      idMapping = result.reduce(
        (idMapping, { id, fields: { uuid } }) => ({
          ...idMapping,
          [id]: uuid
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
      airtableObject[airtableColumnName(mapping)] = isObject(mapping)
        ? await mapping.valueMap(record, associations)
        : record[mapping];
    }

    return airtableObject;
  }
}

export type Include = {
  model?: ModelType<unknown, unknown>;
  association?: string;
  attributes?: string[];
};

/**
 * A ColumnMapping is either a string (airtableColumn and dbColumn are the same), or a more descriptive object
 */
export type ColumnMapping<T extends Model<T>, A = Record<string, never>> =
  | keyof Attributes<T>
  | {
      airtableColumn: string;
      // Include if this mapping should include a particular DB column in the DB query
      dbColumn?: keyof Attributes<T> | (keyof Attributes<T>)[];
      // Include if this mapping should eager load an association on the DB query
      include?: Include[];
      valueMap: (entity: T, associations: A) => Promise<null | string | number | boolean | Date>;
    };

// used in the test suite
export const airtableColumnName = <T extends Model<T>>(mapping: ColumnMapping<T, unknown>) =>
  isObject(mapping) ? mapping.airtableColumn : (mapping as string);

const selectAttributes = <T extends Model<T>, A>(columns: ColumnMapping<T, A>[]) =>
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

const selectIncludes = <T extends Model<T>, A>(columns: ColumnMapping<T, A>[]) =>
  columns.reduce((includes, mapping) => {
    if (!isObject(mapping)) return includes;
    if (mapping.include == null) return includes;

    return mapping.include.reduce(mergeInclude, includes);
  }, [] as Include[]);

type UuidModel<T> = Model<T> & { uuid: string };
export const commonEntityColumns = <T extends UuidModel<T>, A = Record<string, never>>(adminSiteType: string) =>
  [
    "uuid",
    "createdAt",
    "updatedAt",
    {
      airtableColumn: "linkToTerramatch",
      dbColumn: "uuid",
      valueMap: ({ uuid }) => `https://www.terramatch.org/admin#/${adminSiteType}/${uuid}/show`
    }
  ] as ColumnMapping<T, A>[];

export const associatedValueColumn = <T extends Model<T>, A>(
  valueName: keyof A,
  dbColumn: keyof Attributes<T> | (keyof Attributes<T>)[]
) =>
  ({
    airtableColumn: valueName,
    dbColumn,
    valueMap: async (_, associations: A) => associations?.[valueName]
  } as ColumnMapping<T, A>);
