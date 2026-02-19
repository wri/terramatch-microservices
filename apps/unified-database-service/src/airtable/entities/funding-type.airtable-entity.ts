/* istanbul ignore file */
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { FinancialReport, FundingType } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";

type FundingTypeAssociations = {
  financialReportUuid?: string;
};

const COLUMNS: ColumnMapping<FundingType, FundingTypeAssociations>[] = [
  ...commonEntityColumns<FundingType>(),
  {
    dbColumn: "organisationId",
    airtableColumn: "organisationUuid",
    valueMap: async ({ organisationId }) => organisationId
  },
  associatedValueColumn("financialReportUuid", "financialReportId"),
  "amount",
  "source",
  {
    dbColumn: "year",
    airtableColumn: "year",
    valueMap: async ({ year }) => `${year}`
  },
  "type"
];

export class FundingTypeEntity extends AirtableEntity<FundingType, FundingTypeAssociations> {
  readonly TABLE_NAME = "Funding Types";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = FundingType;

  protected async loadAssociations(fundingTypes: FundingType[]) {
    const reportIds = uniq(fundingTypes.map(({ financialReportId }) => financialReportId)).filter(isNotNull);
    if (reportIds.length === 0) return {} as FundingTypeAssociations;

    const reports = await FinancialReport.findAll({ where: { id: reportIds }, attributes: ["id", "uuid"] });
    return fundingTypes.reduce(
      (associations, { id, financialReportId }) => ({
        ...associations,
        [id]: { financialReportUuid: reports.find(({ id }) => id === financialReportId)?.uuid }
      }),
      {} as Record<number, FundingTypeAssociations>
    );
  }
}
