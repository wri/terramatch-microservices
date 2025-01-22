import { Seeding, Site, SiteReport } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { groupBy, uniq } from "lodash";

type SiteReportAssociations = {
  siteUuid?: string;
  totalSeedsPlanted: number;
};

const COLUMNS: ColumnMapping<SiteReport, SiteReportAssociations>[] = [
  ...commonEntityColumns<SiteReport, SiteReportAssociations>("siteReport"),
  associatedValueColumn("siteUuid", "siteId"),
  "status",
  "updateRequestStatus",
  "dueAt",
  "pctSurvivalToDate",
  "survivalCalculation",
  "survivalDescription",
  "maintenanceActivities",
  "regenerationDescription",
  "technicalNarrative",
  "publicNarrative",
  associatedValueColumn("totalSeedsPlanted", "id"),
  "numTreesRegenerating",
  "soilWaterRestorationDescription",
  "waterStructures"
];

export class SiteReportEntity extends AirtableEntity<SiteReport, SiteReportAssociations> {
  readonly TABLE_NAME = "Site Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = SiteReport;

  protected async loadAssociations(siteReports: SiteReport[]) {
    const reportIds = siteReports.map(({ id }) => id);
    const siteIds = uniq(siteReports.map(({ siteId }) => siteId));
    const sites = await Site.findAll({
      where: { id: siteIds },
      attributes: ["id", "uuid"]
    });
    const seedsPlanted = groupBy(
      await Seeding.findAll({
        where: {
          seedableId: reportIds,
          seedableType: SiteReport.LARAVEL_TYPE,
          hidden: false
        },
        attributes: ["seedableId", "name", "amount"]
      }),
      "seedableId"
    );

    return siteReports.reduce(
      (associations, { id, siteId }) => ({
        ...associations,
        [id]: {
          siteUuid: sites.find(({ id }) => id === siteId)?.uuid,
          totalSeedsPlanted: (seedsPlanted[id] ?? []).reduce((sum, { amount }) => sum + (amount ?? 0), 0)
        }
      }),
      {} as Record<number, SiteReportAssociations>
    );
  }
}
