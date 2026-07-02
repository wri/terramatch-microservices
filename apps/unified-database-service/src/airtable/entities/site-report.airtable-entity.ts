import { Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  treeAmountRollup,
  treeDescriptionRollup,
  UpdateAssociation
} from "./airtable-entity";
import { groupBy, uniq } from "lodash";

type SiteReportAssociations = {
  siteUuid?: string;
  treePlantedAmount?: number | null;
  treePlantedNameAndAmount?: string;
  nonTreeAmount?: number | null;
  nonTreeNameAndAmount?: string;
  replantingAmount?: number | null;
  replantingNameAndAmount?: string;
  invasiveAmount?: number | null;
  invasiveNameAndAmount?: string;
  anrAmount?: number | null;
  anrNameAndAmount?: string;
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
  "numTreesRegenerating",
  "soilWaterRestorationDescription",
  "waterStructures",
  "polygonStatus",
  "invasiveSpeciesRemoved",
  "invasiveSpeciesManagement",
  "siteCommunityPartnersDescription",
  "siteCommunityPartnersIncomeIncreaseDescription",
  "nothingToReport",
  "plantingStatus",
  "anrPractices",
  {
    airtableColumn: "workdaysPaidSelfReported",
    dbColumn: "workdaysPaid",
    valueMap: async ({ workdaysPaid }) => workdaysPaid
  },
  {
    airtableColumn: "workdaysVolunteerSelfReported",
    dbColumn: "workdaysVolunteer",
    valueMap: async ({ workdaysVolunteer }) => workdaysVolunteer
  },
  associatedValueColumn("treePlantedAmount"),
  associatedValueColumn("treePlantedNameAndAmount"),
  associatedValueColumn("nonTreeAmount"),
  associatedValueColumn("nonTreeNameAndAmount"),
  associatedValueColumn("replantingAmount"),
  associatedValueColumn("replantingNameAndAmount"),
  associatedValueColumn("invasiveAmount"),
  associatedValueColumn("invasiveNameAndAmount"),
  associatedValueColumn("anrAmount"),
  associatedValueColumn("anrNameAndAmount")
];

const TREE_ASSOCIATION: UpdateAssociation<SiteReport, TreeSpecies> = {
  model: TreeSpecies,
  on: ["id", "speciesableId"],
  scope: {
    speciesableType: SiteReport.LARAVEL_TYPE
  }
};

export class SiteReportEntity extends AirtableEntity<SiteReport, SiteReportAssociations> {
  readonly TABLE_NAME = "Site Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = SiteReport;
  readonly UPDATE_ASSOCIATIONS = [TREE_ASSOCIATION];

  protected async loadAssociations(siteReports: SiteReport[]) {
    const siteIds = uniq(siteReports.map(({ siteId }) => siteId));
    const sites = await Site.findAll({
      where: { id: siteIds },
      attributes: ["id", "uuid"]
    });
    const treesByReport = groupBy(await TreeSpecies.visible().for(siteReports).findAll(), "speciesableId");

    return siteReports.reduce(
      (associations, { id, siteId }) => ({
        ...associations,
        [id]: {
          siteUuid: sites.find(({ id }) => id === siteId)?.uuid,
          treePlantedAmount: treeAmountRollup(treesByReport[id], "tree-planted"),
          treePlantedNameAndAmount: treeDescriptionRollup(treesByReport[id], "tree-planted"),
          nonTreeAmount: treeAmountRollup(treesByReport[id], "non-tree"),
          nonTreeNameAndAmount: treeDescriptionRollup(treesByReport[id], "non-tree"),
          replantingAmount: treeAmountRollup(treesByReport[id], "replanting"),
          replantingNameAndAmount: treeDescriptionRollup(treesByReport[id], "replanting"),
          invasiveAmount: treeAmountRollup(treesByReport[id], "invasive"),
          invasiveNameAndAmount: treeDescriptionRollup(treesByReport[id], "invasive"),
          anrAmount: treeAmountRollup(treesByReport[id], "anr"),
          anrNameAndAmount: treeDescriptionRollup(treesByReport[id], "anr")
        }
      }),
      {} as Record<number, SiteReportAssociations>
    );
  }
}
