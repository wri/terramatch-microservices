import { AirtableEntity } from "./airtable-entity";
import { Project, Site, TreeSpecies } from "@terramatch-microservices/database/entities";
import { groupBy, uniq } from "lodash";
import {
  associatedValueColumn,
  commonEntityColumns,
  percentageColumn,
  treeAmountRollup,
  treeDescriptionRollup
} from "../util/columns";
import { ColumnMapping, UpdateAssociation } from "../util/types";

type SiteAssociations = {
  projectUuid?: string;
  treePlantedAmount: number | null;
  treePlantedNameAndAmount: string;
  nonTreeAmount: number | null;
  nonTreeNameAndAmount: string;
  invasiveAmount: number | null;
  invasiveNameAndAmount: string;
};

const COLUMNS: ColumnMapping<Site, SiteAssociations>[] = [
  ...commonEntityColumns<Site, SiteAssociations>("site"),
  "name",
  associatedValueColumn("projectUuid", "projectId"),
  "status",
  "updateRequestStatus",
  "sitingStrategy",
  "descriptionSitingStrategy",
  "controlSite",
  "landUseTypes",
  "restorationStrategy",
  "description",
  "history",
  "startDate",
  "endDate",
  "landTenures",
  percentageColumn("survivalRatePlanted"),
  percentageColumn("directSeedingSurvivalRate"),
  percentageColumn("aimYearFiveCrownCover"),
  "aNatRegenerationTreesPerHectare",
  "aNatRegeneration",
  "landscapeCommunityContribution",
  "aimNumberOfMatureTrees",
  "soilCondition",
  "plantingPattern",
  "ppcExternalId",
  "detailedInterventionTypes",
  "hectaresToRestoreGoal",
  associatedValueColumn("treePlantedAmount"),
  associatedValueColumn("treePlantedNameAndAmount"),
  associatedValueColumn("nonTreeAmount"),
  associatedValueColumn("nonTreeNameAndAmount"),
  associatedValueColumn("invasiveAmount"),
  associatedValueColumn("invasiveNameAndAmount")
];

const TREE_ASSOCIATION: UpdateAssociation<Site, TreeSpecies> = {
  model: TreeSpecies,
  on: ["id", "speciesableId"],
  scope: {
    speciesableType: Site.LARAVEL_TYPE
  }
};

export class SiteEntity extends AirtableEntity<Site, SiteAssociations> {
  readonly TABLE_NAME = "Sites";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Site;
  readonly UPDATE_ASSOCIATIONS = [TREE_ASSOCIATION];

  protected async loadAssociations(sites: Site[]) {
    const projectIds = uniq(sites.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });
    const treesBySite = groupBy(await TreeSpecies.visible().for(sites).findAll(), "speciesableId");

    return sites.reduce(
      (associations, { id, projectId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid,
          treePlantedAmount: treeAmountRollup(treesBySite[id], "tree-planted"),
          treePlantedNameAndAmount: treeDescriptionRollup(treesBySite[id], "tree-planted"),
          nonTreeAmount: treeAmountRollup(treesBySite[id], "non-tree"),
          nonTreeNameAndAmount: treeDescriptionRollup(treesBySite[id], "non-tree"),
          invasiveAmount: treeAmountRollup(treesBySite[id], "invasive"),
          invasiveNameAndAmount: treeDescriptionRollup(treesBySite[id], "invasive")
        }
      }),
      {} as Record<number, SiteAssociations>
    );
  }
}
