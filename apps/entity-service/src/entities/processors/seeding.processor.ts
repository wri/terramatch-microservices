import { AssociationProcessor } from "./association-processor";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { SeedingDto } from "../dto/seeding.dto";
import { Seeding } from "@terramatch-microservices/database/entities";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

export class SeedingProcessor<EntityModelType extends EntityModel> extends AssociationProcessor<
  Seeding,
  SeedingDto,
  EntityModelType
> {
  readonly DTO = SeedingDto;

  async addDtos(document: DocumentBuilder) {
    const seedableType = this.entityModelClass.LARAVEL_TYPE;

    const { id: seedableId } = await this.getBaseEntity();
    const seedings = await Seeding.findAll({
      where: {
        seedableType,
        seedableId,
        hidden: false
      }
    });

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    for (const seeding of seedings) {
      document.addData(seeding.uuid, new SeedingDto(seeding, additionalProps));
    }
  }
}
