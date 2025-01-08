import { Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associationReducer, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { uniq } from "lodash";

const loadReportTreesPlanted = async (siteReportIds: number[]) =>
  (
    await TreeSpecies.findAll({
      where: {
        speciesableId: siteReportIds,
        speciesableType: SiteReport.LARAVEL_TYPE,
        collection: "tree-planted",
        hidden: false
      },
      attributes: ["speciesableId", "name", "amount"]
    })
  ).reduce(associationReducer<TreeSpecies>("speciesableId"), {});

type SiteReportAssociations = {
  siteUuid?: string;
  totalTreesPlanted: number;
};

const COLUMNS: ColumnMapping<SiteReport, SiteReportAssociations>[] = [
  ...commonEntityColumns<SiteReport, SiteReportAssociations>("siteReport"),
  {
    airtableColumn: "siteUuid",
    dbColumn: "siteId",
    valueMap: async (_, { siteUuid }) => siteUuid
  },
  "status",
  "updateRequestStatus",
  "dueAt",
  {
    airtableColumn: "totalTreesPlantedReport",
    dbColumn: "id",
    valueMap: async (_, { totalTreesPlanted }) => totalTreesPlanted
  }
];

export class SiteReportEntity extends AirtableEntity<SiteReport, SiteReportAssociations> {
  readonly TABLE_NAME = "Site Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = SiteReport;

  protected async loadAssociations(siteReports: SiteReport[]) {
    const siteReportIds = siteReports.map(({ id }) => id);
    const siteIds = uniq(siteReports.map(({ siteId }) => siteId));
    const sites = await Site.findAll({
      where: { id: siteIds },
      attributes: ["id", "uuid"]
    });
    const treesPlanted = await loadReportTreesPlanted(siteReportIds);

    return siteReports.reduce(
      (associations, { id, siteId }) => ({
        ...associations,
        [id]: {
          siteUuid: sites.find(({ id }) => id === siteId)?.uuid,
          totalTreesPlanted: (treesPlanted[id] ?? []).reduce((sum, { amount }) => sum + amount, 0)
        }
      }),
      {} as Record<number, SiteReportAssociations>
    );
  }
}
