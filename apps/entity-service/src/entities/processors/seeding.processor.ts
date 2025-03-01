import { AssociationProcessor } from "./association-processor";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { SeedingDto } from "../dto/seeding.dto";
import { Seeding } from "@terramatch-microservices/database/entities";

export class SeedingProcessor<EntityModelType extends EntityModel> extends AssociationProcessor<
  Seeding,
  SeedingDto,
  EntityModelType
> {
  readonly DTO = SeedingDto;

  async getAssociations({ id: seedableId }) {
    return await Seeding.findAll({
      where: { seedableType: this.entityModelClass.LARAVEL_TYPE, seedableId, hidden: false }
    });
  }
}
