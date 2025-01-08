import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Nursery, Project } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";

type NurseryAssociations = {
  projectUuid?: string;
};

const COLUMNS: ColumnMapping<Nursery, NurseryAssociations>[] = [
  ...commonEntityColumns<Nursery, NurseryAssociations>("nursery"),
  "name",
  {
    airtableColumn: "projectUuid",
    dbColumn: "projectId",
    valueMap: async (_, { projectUuid }) => projectUuid
  },
  "status",
  "updateRequestStatus"
];

export class NurseryEntity extends AirtableEntity<Nursery, NurseryAssociations> {
  readonly TABLE_NAME = "Nurseries";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Nursery;

  protected async loadAssociations(nurseries: Nursery[]) {
    const projectIds = uniq(nurseries.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });

    return nurseries.reduce(
      (associations, { id, projectId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid
        }
      }),
      {} as Record<number, NurseryAssociations>
    );
  }
}
