/* istanbul ignore file */
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Project, SrpReport } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";

type SrpReportAssociations = {
  projectUuid?: string;
};

const COLUMNS: ColumnMapping<SrpReport, SrpReportAssociations>[] = [
  ...commonEntityColumns<SrpReport>("srpReport"),
  "frameworkKey",
  "status",
  "updateRequestStatus",
  "nothingToReport",
  associatedValueColumn("projectUuid", "projectId"),
  "year",
  {
    airtableColumn: "year",
    dbColumn: "year",
    valueMap: async ({ year }) => `${year}`
  },
  "restorationPartnersDescription",
  "totalUniqueRestorationPartners",
  "dueAt",
  "submittedAt"
];

export class SrpReportEntity extends AirtableEntity<SrpReport, SrpReportAssociations> {
  readonly TABLE_NAME = "SRP Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = SrpReport;

  protected async loadAssociations(srpReports: SrpReport[]) {
    const projectIds = uniq(srpReports.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });

    return srpReports.reduce(
      (associations, { id, projectId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid
        }
      }),
      {} as Record<number, SrpReportAssociations>
    );
  }
}
