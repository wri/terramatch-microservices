import { AssociationProcessor } from "./association-processor";
import { Demographic } from "@terramatch-microservices/database/entities";
import { DemographicDto } from "../dto/demographic.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";

export class DemographicProcessor<EntityModelType extends EntityModel> extends AssociationProcessor<
  Demographic,
  DemographicDto,
  EntityModelType
> {
  readonly DTO = DemographicDto;

  async addDtos(document: DocumentBuilder) {
    const demographicalType = this.entityModelClass.LARAVEL_TYPE;

    const { id: demographicalId } = await this.getBaseEntity();
    const demographics = await Demographic.findAll({
      where: {
        demographicalType,
        demographicalId,
        hidden: false
      },
      include: [{ association: "entries" }]
    });

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    for (const demographic of demographics) {
      document.addData(demographic.uuid, new DemographicDto(demographic, { ...additionalProps }));
    }
  }
}
