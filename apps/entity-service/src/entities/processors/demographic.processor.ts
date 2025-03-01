import { AssociationProcessor } from "./association-processor";
import { Demographic } from "@terramatch-microservices/database/entities";
import { DemographicDto } from "../dto/demographic.dto";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";

export class DemographicProcessor<EntityModelType extends EntityModel> extends AssociationProcessor<
  Demographic,
  DemographicDto,
  EntityModelType
> {
  readonly DTO = DemographicDto;

  async getAssociations({ id: demographicalId }) {
    return await Demographic.findAll({
      where: { demographicalType: this.entityModelClass.LARAVEL_TYPE, demographicalId, hidden: false },
      include: [{ association: "entries" }]
    });
  }
}
