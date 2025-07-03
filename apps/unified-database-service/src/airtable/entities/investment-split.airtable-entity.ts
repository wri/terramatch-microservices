/* istanbul ignore file */
import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Investment, InvestmentSplit } from "@terramatch-microservices/database/entities";

const COLUMNS: ColumnMapping<InvestmentSplit>[] = [
  ...commonEntityColumns<InvestmentSplit>(),
  {
    airtableColumn: "investmentUuid",
    include: [{ model: Investment, attributes: ["uuid"] }],
    valueMap: async ({ investment }) => investment?.uuid
  },
  "funder",
  "amount"
];

export class InvestmentSplitEntity extends AirtableEntity<InvestmentSplit> {
  readonly TABLE_NAME = "Investment Splits";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = InvestmentSplit;
}
