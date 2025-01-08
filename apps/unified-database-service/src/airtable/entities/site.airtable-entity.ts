import { AirtableEntity, ColumnMapping } from "./airtable-entity";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";

type SiteAssociations = {
  projectUuid?: string;
};

const COLUMNS: ColumnMapping<Site, SiteAssociations>[] = [
  "uuid",
  "createdAt",
  "updatedAt",
  "name",
  {
    airtableColumn: "linkToTerramatch",
    dbColumn: "uuid",
    valueMap: async ({ uuid }) => `https://www.terramatch.org/admin#/site/${uuid}/show`
  },
  {
    airtableColumn: "projectUuid",
    dbColumn: "projectId",
    valueMap: async (_, { projectUuid }) => projectUuid
  },
  "status",
  "updateRequestStatus",
  "sitingStrategy",
  "descriptionSitingStrategy"
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
