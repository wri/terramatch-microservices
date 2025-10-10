/* istanbul ignore file */
import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { FundingType } from "@terramatch-microservices/database/entities";

const COLUMNS: ColumnMapping<FundingType>[] = [
  ...commonEntityColumns<FundingType>(),
  {
    dbColumn: "organisationId",
    airtableColumn: "organisationUuid",
    valueMap: async ({ organisationId }) => organisationId
  },
  "amount",
  "source",
  {
    dbColumn: "year",
    airtableColumn: "year",
    valueMap: async ({ year }) => `${year}`
  },
  "type"
];

export class FundingTypeEntity extends AirtableEntity<FundingType> {
  readonly TABLE_NAME = "Funding Types";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = FundingType;
}
