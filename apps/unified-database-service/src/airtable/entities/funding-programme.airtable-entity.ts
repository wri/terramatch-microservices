import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { FundingProgramme } from "@terramatch-microservices/database/entities";

const COLUMNS: ColumnMapping<FundingProgramme>[] = [
  ...commonEntityColumns<FundingProgramme>("fundingProgramme"),
  "name",
  "frameworkKey",
  "status",
  "description",
  "location",
  "organisationTypes"
];

export class FundingProgrammeEntity extends AirtableEntity<FundingProgramme> {
  readonly TABLE_NAME = "Funding Programmes";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = FundingProgramme;
}
