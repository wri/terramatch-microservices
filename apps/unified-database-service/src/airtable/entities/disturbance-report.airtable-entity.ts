/* istanbul ignore file */
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns, Include } from "./airtable-entity";
import { DisturbanceReport, Project } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";
import { Op, WhereOptions } from "sequelize";
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

export class DisturbanceReportEntity extends AirtableEntity<DisturbanceReport, DisturbanceReportAssociations> {
  readonly TABLE_NAME = "Disturbance Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = DisturbanceReport;

  // Override the default behavior to both include all entries in the page and to include the
  // entry updatedAt field as part of the where clause if updatedSince is not null.
  protected getUpdatePageFindOptions(page: number, updatedSince?: Date) {
    const options = super.getUpdatePageFindOptions(page, updatedSince);

    const entryInclude: Include = { association: "entries", attributes: ["name", "value", "deletedAt"] };
    (options.include as Include[]).push(entryInclude);
    if (updatedSince != null) {
      // If allowed to do the default behavior of wrapping in a subquery, the entry.updated_at field
      // is not accessible to the where clause.
      options.subQuery = false;
      options.where = {
        [Op.or]: [
          options.where as WhereOptions<DisturbanceReport>,
          {
            "$entries.updated_at$": { [Op.gte]: updatedSince }
          },
          {
            "$entries.deleted_at$": { [Op.gte]: updatedSince }
          }
        ]
      };
      // we have to make sure to join against entries that were deleted since the timestamp so that
      // those reports count as updated as well.
      entryInclude.paranoid = false;
      entryInclude.where = { [Op.or]: [{ deletedAt: null }, { deletedAt: { [Op.gte]: updatedSince } }] };
    }

    return options;
  }

  protected async loadAssociations(reports: DisturbanceReport[]) {
    const projectIds = uniq(reports.map(({ projectId }) => projectId));
    const projects = await Project.findAll({ where: { id: projectIds }, attributes: ["id", "uuid"] });

    return reports.reduce(
      (associations, { id, projectId, entries }) => {
        const { disturbanceData, affectedPolygonUuids } = getEntryData(
          (entries ?? []).filter(({ deletedAt }) => deletedAt == null)
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
