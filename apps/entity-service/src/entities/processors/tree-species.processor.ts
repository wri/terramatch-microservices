import { AssociationProcessor } from "./association-processor";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { TreeSpeciesDto } from "../dto/tree-species.dto";
import { TreeSpecies } from "@terramatch-microservices/database/entities";

export class TreeSpeciesProcessor<EntityModelType extends EntityModel> extends AssociationProcessor<
  TreeSpecies,
  TreeSpeciesDto,
  EntityModelType
> {
  readonly DTO = TreeSpeciesDto;

  async getAssociations({ id: speciesableId }) {
    return await TreeSpecies.findAll({
      where: { speciesableType: this.entityModelClass.LARAVEL_TYPE, speciesableId, hidden: false }
    });
  }
}
