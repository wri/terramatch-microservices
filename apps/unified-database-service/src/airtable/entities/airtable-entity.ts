import { Model, ModelCtor } from "sequelize-typescript";
import { groupBy, isEmpty, isObject, isString, keyBy, mapValues, merge, uniq } from "lodash";
import { Attributes, FindOptions, Op, WhereOptions } from "sequelize";
import Airtable from "airtable";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Dictionary } from "factory-girl-ts";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

import { ColumnMapping, FilterFlag, PolymorphicUuidAssociation, UpdateAssociation } from "../util/types";
import { airtableColumnName } from "../util/columns";
import { selectAttributes, selectIncludes } from "../util/db";
import { BaseId } from "../airtable.processor";

// The Airtable API only supports bulk updates of up to 10 rows.
const AIRTABLE_PAGE_SIZE = 10;

type UpdateBaseOptions = { startPage?: number; updatedSince?: Date };

// Limit in Airtable
const LONG_TEXT_MAX_LENGTH = 100000;

const getFilterFlags = (flags: (string | FilterFlag)[]): FilterFlag[] =>
  flags.map(flag => ({
    attribute: isString(flag) ? flag : flag.attribute,
    hideCondition: isString(flag) ? true : flag.hideCondition
  }));

export abstract class AirtableEntity<ModelType extends Model, AssociationType = Record<string, never>> {
  readonly BASE_ID: BaseId = "defaultBase";
  abstract readonly TABLE_NAME: string;
  abstract readonly COLUMNS: ColumnMapping<ModelType, AssociationType>[];
  abstract readonly MODEL: ModelCtor<ModelType>;
  readonly IDENTITY_COLUMN: string = "uuid";
  readonly SUPPORTS_UPDATED_SINCE: boolean = true;
  readonly FILTER_FLAGS: (string | FilterFlag)[] = [];
  // Used to include an association in the selection of IDs to update when updatedSince is used. Ignored
  // if SUPPORTS_UPDATED_SINCE is false.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly UPDATE_ASSOCIATIONS: UpdateAssociation<ModelType, any>[] = [];

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
    const where = { id: { [Op.in]: this.getUpdateIdSubquery(updatedSince).literal } } as WhereOptions<ModelType>;
    const count = await this.MODEL.count({ where });
    if (count === 0) {
      this.logger.log(`No updates to process, skipping: ${JSON.stringify({ table: this.TABLE_NAME, updatedSince })}`);
      return;
    }

    const expectedPages = Math.floor(count / AIRTABLE_PAGE_SIZE);
    for (let page = startPage ?? 0; await this.processUpdatePage(base, page, updatedSince); page++) {
      this.logger.log(
        `Processed update page: ${JSON.stringify({ table: this.TABLE_NAME, page: page + 1, expectedPages: expectedPages + 1 })}`
      );
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

  /**
   * Creates a subquery that calculates all the IDs that should be included in an update process with
   * the optional updatedSince time stamp.
   *
   * If this processor supports it, this will take into account any associations that are specified in
   * UPDATE_ASSOCIATIONS to find records whose dependent associations have been updated.
   */
  protected getUpdateIdSubquery(updatedSince?: Date) {
    const subquery = Subquery.select(this.MODEL, "id", { distinct: true });

    if (!isEmpty(this.FILTER_FLAGS)) {
      for (const { attribute, hideCondition } of getFilterFlags(this.FILTER_FLAGS)) {
        subquery.eq(attribute, !hideCondition);
      }
    }

    if (this.SUPPORTS_UPDATED_SINCE && updatedSince != null) {
      if (isEmpty(this.UPDATE_ASSOCIATIONS)) {
        subquery.gte("updatedAt", updatedSince);
      } else {
        let whereClause = subquery.clauses.gte("updatedAt", updatedSince);

        // Builds up join queries that will include any item from UPDATE_ASSOCIATIONS that has been updated
        // or deleted since the updatedSince timestamp.
        for (const [index, association] of this.UPDATE_ASSOCIATIONS.entries()) {
          const as = `association_${index}`;
          const modelColumn = subquery.clauses.field(association.on[0]);
          const joinClauses = Subquery.clauseBuilder(association.model, as);
          const joinModelColumn = joinClauses.field(association.on[1]);
          let on = `${modelColumn} = ${joinModelColumn} AND (${joinClauses.isNull("deletedAt")} OR ${joinClauses.gte("deletedAt", updatedSince)})`;

          if (association.scope != null) {
            for (const [attribute, value] of Object.entries(association.scope)) {
              if (value != null) on += ` AND ${joinClauses.eq(attribute, value)}`;
            }
          }

          // Include any row from the base table that has an update association where that association was
          // updated or deleted since the updatedSince timestamp.
          whereClause += ` OR ${joinClauses.gte("updatedAt", updatedSince)} OR ${joinClauses.gte("deletedAt", updatedSince)}`;

          subquery.leftJoin(association.model, as, on);
        }

        subquery.andLiteral(`(${whereClause})`);
      }
    }

    return subquery;
  }

  protected getUpdatePageFindOptions(page: number, updatedSince?: Date) {
    const where = { id: { [Op.in]: this.getUpdateIdSubquery(updatedSince).literal } } as WhereOptions<ModelType>;

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
    const where: Record<string | symbol, unknown> = {};

    const deletedAtCondition = { [Op.gte]: deletedSince };
    if (isEmpty(this.FILTER_FLAGS)) {
      where["deletedAt"] = deletedAtCondition;
    } else {
      where[Op.or] = {
        deletedAt: deletedAtCondition,
        // include records that have been hidden since the timestamp as well
        [Op.and]: {
          updatedAt: { ...deletedAtCondition },
          [Op.or]: getFilterFlags(this.FILTER_FLAGS).reduce(
            (flags, { attribute, hideCondition }) => ({ ...flags, [attribute]: hideCondition }),
            {}
          )
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
      this.logger.error(
        `Airtable mapping failed: ${JSON.stringify({ entity: this.TABLE_NAME, page })}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }

    try {
      // @ts-expect-error the types for this lib haven't caught up with its support for upserts
      // https://github.com/Airtable/airtable.js/issues/348
      await base(this.TABLE_NAME).update(airtableRecords, {
        performUpsert: { fieldsToMergeOn: [this.IDENTITY_COLUMN] },
        // Enables new multi/single selection options to be populated by this upsert.
        typecast: true
      });
    } catch (error) {
      this.logger.error(
        `Entity update failed: ${JSON.stringify({ entity: this.TABLE_NAME, page, airtableRecords }, null, 2)}`,
        error instanceof Error ? error.stack : undefined
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
        .map(record => `{${this.IDENTITY_COLUMN}}='${record[this.IDENTITY_COLUMN as keyof typeof record]}'`)
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
        error instanceof Error ? error.stack : undefined
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
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }

    // True signals that processing succeeded and the next page should begin
    return true;
  }

  protected async mapEntityColumns(record: ModelType, associations: AssociationType) {
    const airtableObject: Dictionary = {};
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
