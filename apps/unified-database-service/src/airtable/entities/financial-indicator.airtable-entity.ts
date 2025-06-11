import { FinancialIndicator, Organisation } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping } from "./airtable-entity";
import { uniq } from "lodash";

type FinancialIndicatorAssociations = {
  organisationUuid?: string;
};

const COLUMNS: ColumnMapping<FinancialIndicator, FinancialIndicatorAssociations>[] = [
  "uuid",
  "createdAt",
  "updatedAt",
  "collection",
  "amount",
  "description",
  associatedValueColumn("organisationUuid", "organisationId")
];

export class FinancialIndicatorEntity extends AirtableEntity<FinancialIndicator, FinancialIndicatorAssociations> {
  readonly TABLE_NAME = "Financial Indicators";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = FinancialIndicator;

  protected async loadAssociations(indicators: FinancialIndicator[]) {
    const orgs = await Organisation.findAll({
      where: { id: uniq(indicators.map(({ organisationId }) => organisationId)) },
      attributes: ["id", "uuid"]
    });
    return indicators.reduce(
      (associations, { id, organisationId }) => ({
        ...associations,
        [id]: {
          organisationUuid: orgs.find(({ id }) => id === organisationId)?.uuid
        }
      }),
      {} as Record<number, FinancialIndicatorAssociations>
    );
  }
}
