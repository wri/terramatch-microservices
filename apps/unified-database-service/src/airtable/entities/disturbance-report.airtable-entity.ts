/* istanbul ignore file */
import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  UpdateAssociation
} from "./airtable-entity";
import { DisturbanceReport, DisturbanceReportEntry, Project } from "@terramatch-microservices/database/entities";
import { groupBy, uniq } from "lodash";
import { Op } from "sequelize";
import { getEntryData } from "@terramatch-microservices/common/events/processors/disturbance-report-entry.approval-processor";

type DisturbanceReportAssociations = {
  projectUuid?: string;
  affectedPolygonUuids?: string[];
  intensity?: string; // single select
  extent?: string; // single select
  type?: string; // single select
  subtype?: string[]; // multi select
  peopleAffected?: number; // integer
  monetaryDamage?: number; // decimal
  propertyAffected?: string[]; // multi select
  disturbanceDate?: Date; // date no timestamp
};

const COLUMNS: ColumnMapping<DisturbanceReport, DisturbanceReportAssociations>[] = [
  ...commonEntityColumns<DisturbanceReport, DisturbanceReportAssociations>(),
  "status",
  "description",
  "actionDescription",
  associatedValueColumn("projectUuid", "projectId"),
  associatedValueColumn("affectedPolygonUuids"),
  associatedValueColumn("intensity"),
  associatedValueColumn("extent"),
  associatedValueColumn("type"),
  associatedValueColumn("subtype"),
  associatedValueColumn("peopleAffected"),
  associatedValueColumn("monetaryDamage"),
  associatedValueColumn("propertyAffected"),
  associatedValueColumn("disturbanceDate")
];

const ENTRY_ASSOCIATION: UpdateAssociation<DisturbanceReport, DisturbanceReportEntry> = {
  model: DisturbanceReportEntry,
  on: ["id", "disturbanceReportId"]
};

export class DisturbanceReportEntity extends AirtableEntity<DisturbanceReport, DisturbanceReportAssociations> {
  readonly TABLE_NAME = "Disturbance Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = DisturbanceReport;
  readonly UPDATE_ASSOCIATIONS = [ENTRY_ASSOCIATION];

  protected async loadAssociations(reports: DisturbanceReport[]) {
    const projectIds = uniq(reports.map(({ projectId }) => projectId));
    const projects = await Project.findAll({ where: { id: projectIds }, attributes: ["id", "uuid"] });
    const entriesByReport = groupBy(
      await DisturbanceReportEntry.findAll({
        where: { disturbanceReportId: { [Op.in]: reports.map(({ id }) => id) } }
      }),
      "disturbanceReportId"
    );

    return reports.reduce(
      (associations, { id, projectId }) => {
        const { disturbanceData, affectedPolygonUuids } = getEntryData(
          (entriesByReport[id] ?? []).filter(({ deletedAt }) => deletedAt == null)
        );
        return {
          ...associations,
          [id]: {
            projectUuid: projects.find(({ id }) => id === projectId)?.uuid,
            affectedPolygonUuids,
            ...disturbanceData
          }
        };
      },
      {} as Record<number, DisturbanceReportAssociations>
    );
  }
}
