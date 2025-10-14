import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  percentageColumn
} from "./airtable-entity";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";

type SiteAssociations = {
  projectUuid?: string;
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
  "plantingPattern"
];

export class SiteEntity extends AirtableEntity<Site, SiteAssociations> {
  readonly TABLE_NAME = "Sites";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Site;

  protected async loadAssociations(sites: Site[]) {
    const projectIds = uniq(sites.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });

    return sites.reduce(
      (associations, { id, projectId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid
        }
      }),
      {} as Record<number, SiteAssociations>
    );
  }
}
