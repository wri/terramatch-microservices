/* istanbul ignore file */
import { FinancialIndicator, FinancialReport, Organisation } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping } from "./airtable-entity";
import { uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";

type FinancialIndicatorAssociations = {
  organisationUuid?: string;
  financialReportUuid?: string;
};

const COLUMNS: ColumnMapping<FinancialIndicator, FinancialIndicatorAssociations>[] = [
  "uuid",
  "createdAt",
  "updatedAt",
  {
    airtableColumn: "year",
    dbColumn: "year",
    valueMap: async ({ year }) => `${year}`
  },
  "collection",
  "amount",
  "description",
  associatedValueColumn("organisationUuid", "organisationId"),
  associatedValueColumn("financialReportUuid", "financialReportId")
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
    const financialReports = await FinancialReport.findAll({
      where: { id: uniq(indicators.map(({ financialReportId }) => financialReportId).filter(isNotNull)) },
      attributes: ["id", "uuid"]
    });
    return indicators.reduce(
      (associations, { id, organisationId, financialReportId }) => ({
        ...associations,
        [id]: {
          organisationUuid: orgs.find(({ id }) => id === organisationId)?.uuid,
          financialReportUuid: financialReports.find(({ id }) => id === financialReportId)?.uuid
        }
      }),
      {} as Record<number, FinancialIndicatorAssociations>
    );
  }
}
