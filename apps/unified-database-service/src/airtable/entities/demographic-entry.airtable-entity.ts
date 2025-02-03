import { Demographic, DemographicEntry } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping } from "./airtable-entity";
import { uniq } from "lodash";

type DemographicEntryAssociations = {
  demographicUuid?: string;
};

const COLUMNS: ColumnMapping<DemographicEntry, DemographicEntryAssociations>[] = [
  "id",
  "type",
  "subtype",
  "name",
  "amount",
  associatedValueColumn("demographicUuid", "demographicId")
];

export class DemographicEntryEntity extends AirtableEntity<DemographicEntry, DemographicEntryAssociations> {
  readonly TABLE_NAME = "Demographic Entries";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = DemographicEntry;
  readonly IDENTITY_COLUMN = "id";

  protected async loadAssociations(entries: DemographicEntry[]) {
    const demographicIds = uniq(entries.map(({ demographicId }) => demographicId));
    const demographics = await Demographic.findAll({
      where: { id: demographicIds },
      attributes: ["id", "uuid"]
    });

    return entries.reduce(
      (associations, { id, demographicId }) => ({
        ...associations,
        [id]: { demographicUuid: demographics.find(({ id }) => id === demographicId)?.uuid }
      }),
      {} as Record<number, DemographicEntryAssociations>
    );
  }
}
