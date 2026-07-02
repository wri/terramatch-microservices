/* istanbul ignore file */
import { AirtableEntity } from "./airtable-entity";
import { Investment, Project } from "@terramatch-microservices/database/entities";
import { commonEntityColumns } from "../util/columns";
import { ColumnMapping } from "../util/types";

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
