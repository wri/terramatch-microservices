/* istanbul ignore file */
import { Leadership, Organisation } from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";

const COLUMNS: ColumnMapping<Leadership>[] = [
  ...commonEntityColumns<Leadership>(),
  {
    airtableColumn: "organisationUuid",
    include: [{ model: Organisation, attributes: ["uuid"] }],
    valueMap: async ({ organisation }) => organisation?.uuid
  },
  "collection",
  "firstName",
  "lastName",
  "position",
  "gender",
  "age",
  "nationality"
];

export class LeadershipEntity extends AirtableEntity<Leadership> {
  readonly TABLE_NAME = "Leaderships";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Leadership;
}
