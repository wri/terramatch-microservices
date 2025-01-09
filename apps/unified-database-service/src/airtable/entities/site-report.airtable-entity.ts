import { Site, SiteReport } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { uniq } from "lodash";

type SiteReportAssociations = {
  siteUuid?: string;
};

const COLUMNS: ColumnMapping<SiteReport, SiteReportAssociations>[] = [
  ...commonEntityColumns<SiteReport, SiteReportAssociations>("siteReport"),
  associatedValueColumn("siteUuid", "siteId"),
  "status",
  "updateRequestStatus",
  "dueAt"
];

export class SiteReportEntity extends AirtableEntity<SiteReport, SiteReportAssociations> {
  readonly TABLE_NAME = "Site Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = SiteReport;

  protected async loadAssociations(siteReports: SiteReport[]) {
    const siteIds = uniq(siteReports.map(({ siteId }) => siteId));
    const sites = await Site.findAll({
      where: { id: siteIds },
      attributes: ["id", "uuid"]
    });

    return siteReports.reduce(
      (associations, { id, siteId }) => ({
        ...associations,
        [id]: {
          siteUuid: sites.find(({ id }) => id === siteId)?.uuid
        }
      }),
      {} as Record<number, SiteReportAssociations>
    );
  }
}
