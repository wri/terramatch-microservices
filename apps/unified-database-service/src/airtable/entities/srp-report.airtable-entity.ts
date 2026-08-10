/* istanbul ignore file */
import { AirtableEntity } from "./airtable-entity";
import { Project, SrpReport, Task } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";
import { associatedValueColumn, commonEntityColumns } from "../util/columns";
import { ColumnMapping } from "../util/types";
import { isNotNull } from "@terramatch-microservices/database/types/array";

type SrpReportAssociations = {
  projectUuid?: string;
  taskUuid?: string;
};

const COLUMNS: ColumnMapping<SrpReport, SrpReportAssociations>[] = [
  ...commonEntityColumns<SrpReport, SrpReportAssociations>("srpReport"),
  "frameworkKey",
  "status",
  "updateRequestStatus",
  "nothingToReport",
  associatedValueColumn("projectUuid", "projectId"),
  associatedValueColumn("taskUuid", "taskId"),
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
    const taskIds = uniq(srpReports.map(({ taskId }) => taskId)).filter(isNotNull);
    const tasks = await Task.findAll({ where: { id: taskIds }, attributes: ["id", "uuid"] });

    return srpReports.reduce(
      (associations, { id, projectId, taskId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid,
          taskUuid: tasks.find(({ id }) => id === taskId)?.uuid
        }
      }),
      {} as Record<number, SrpReportAssociations>
    );
  }
}
