import { AirtableEntity } from "./airtable-entity";
import { Nursery, Project, TreeSpecies } from "@terramatch-microservices/database/entities";
import { groupBy, uniq } from "lodash";
import { associatedValueColumn, commonEntityColumns, treeAmountRollup, treeDescriptionRollup } from "../util/columns";
import { ColumnMapping, UpdateAssociation } from "../util/types";

type NurseryAssociations = {
  projectUuid?: string;
  nurserySeedlingAmount: number | null;
  nurserySeedlingNameAndAmount: string;
};

const COLUMNS: ColumnMapping<Nursery, NurseryAssociations>[] = [
  ...commonEntityColumns<Nursery, NurseryAssociations>("nursery"),
  "name",
  associatedValueColumn("projectUuid", "projectId"),
  "status",
  "updateRequestStatus",
  "seedlingGrown",
  "type",
  "startDate",
  "endDate",
  "plantingContribution",
  associatedValueColumn("nurserySeedlingAmount"),
  associatedValueColumn("nurserySeedlingNameAndAmount")
];

const TREE_ASSOCIATION: UpdateAssociation<Nursery, TreeSpecies> = {
  model: TreeSpecies,
  on: ["id", "speciesableId"],
  scope: {
    speciesableType: Nursery.LARAVEL_TYPE
  }
};

export class NurseryEntity extends AirtableEntity<Nursery, NurseryAssociations> {
  readonly TABLE_NAME = "Nurseries";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Nursery;
  readonly UPDATE_ASSOCIATIONS = [TREE_ASSOCIATION];

  protected async loadAssociations(nurseries: Nursery[]) {
    const projectIds = uniq(nurseries.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });
    const treesByNursery = groupBy(await TreeSpecies.visible().for(nurseries).findAll(), "speciesableId");

    return nurseries.reduce(
      (associations, { id, projectId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid,
          nurserySeedlingAmount: treeAmountRollup(treesByNursery[id], "nursery-seedling"),
          nurserySeedlingNameAndAmount: treeDescriptionRollup(treesByNursery[id], "nursery-seedling")
        }
      }),
      {} as Record<number, NurseryAssociations>
    );
  }
}
