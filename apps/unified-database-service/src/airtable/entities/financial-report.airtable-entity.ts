/* istanbul ignore file */
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { FinancialReport, Organisation } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";

type FinancialReportAssociations = {
  organisationUuid?: string;
};

const COLUMNS: ColumnMapping<FinancialReport, FinancialReportAssociations>[] = [
  ...commonEntityColumns<FinancialReport>("financialReport"),
  "status",
  "updateRequestStatus",
  associatedValueColumn("organisationUuid", "organisationId"),
  {
    dbColumn: "yearOfReport",
    airtableColumn: "yearOfReport",
    valueMap: async ({ yearOfReport }) => `${yearOfReport}`
  },
  "approvedAt",
  "submittedAt",
  "dueAt"
];

export class FinancialReportEntity extends AirtableEntity<FinancialReport, FinancialReportAssociations> {
  readonly TABLE_NAME = "Financial Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = FinancialReport;

  protected async loadAssociations(reports: FinancialReport[]) {
    const organisationIds = uniq(reports.map(({ organisationId }) => organisationId));
    const organisations = await Organisation.findAll({
      where: { id: organisationIds },
      attributes: ["id", "uuid"]
    });

    return reports.reduce(
      (associations, { id, organisationId }) => ({
        ...associations,
        [id]: { organisationUuid: organisations.find(({ id }) => id === organisationId)?.uuid }
      }),
      {} as Record<number, FinancialReportAssociations>
    );
  }
}
