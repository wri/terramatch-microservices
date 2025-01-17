import { Demographic, Workday } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping } from "./airtable-entity";
import { uniq } from "lodash";
import { FindOptions } from "sequelize";

type DemographicAssociations = {
  workdayUuid?: string;
};

const COLUMNS: ColumnMapping<Demographic, DemographicAssociations>[] = [
  "id",
  "type",
  "subtype",
  "name",
  "amount",
  associatedValueColumn("workdayUuid", ["demographicalId"])
];

export class DemographicEntity extends AirtableEntity<Demographic, DemographicAssociations> {
  readonly TABLE_NAME = "Demographics";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Demographic;
  readonly IDENTITY_COLUMN = "id";

  protected getUpdatePageFindOptions(page: number, updatedSince?: Date): FindOptions<Demographic> {
    const findOptions = super.getUpdatePageFindOptions(page, updatedSince);
    return {
      ...findOptions,
      where: {
        ...findOptions.where,
        // only include records that are attached to workdays.
        demographicalType: Workday.LARAVEL_TYPE
      }
    };
  }

  protected getDeletePageFindOptions(deletedSince: Date, page: number): FindOptions<Demographic> {
    const findOptions = super.getDeletePageFindOptions(deletedSince, page);
    return {
      ...findOptions,
      where: {
        ...findOptions.where,
        // only include records that are attached to workdays.
        demographicalType: Workday.LARAVEL_TYPE
      }
    };
  }

  protected async loadAssociations(demographics: Demographic[]) {
    const workdayIds = uniq(demographics.map(({ demographicalId }) => demographicalId));
    const workdays = await Workday.findAll({
      where: { id: workdayIds },
      attributes: ["id", "uuid"]
    });

    return demographics.reduce(
      (associations, { id, demographicalId }) => ({
        ...associations,
        [id]: {
          workdayUuid: workdays.find(({ id }) => id === demographicalId)?.uuid
        }
      }),
      {} as Record<number, DemographicAssociations>
    );
  }
}
