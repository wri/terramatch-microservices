/* istanbul ignore file */
import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Investment, Project } from "@terramatch-microservices/database/entities";

const COLUMNS: ColumnMapping<Investment>[] = [
  ...commonEntityColumns<Investment>(),
  {
    airtableColumn: "projectUuid",
    include: [{ model: Project, attributes: ["uuid"] }],
    valueMap: async ({ project }) => project?.uuid
  },
  "investmentDate",
  "type"
];

export class InvestmentEntity extends AirtableEntity<Investment> {
  readonly TABLE_NAME = "Investments";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Investment;
}
