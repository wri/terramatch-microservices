import { Controller, Get, Param } from "@nestjs/common";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ApiExtraModels } from "@nestjs/swagger";
import { DemographicEntryDto } from "./dto/demographic.dto";

@Controller("entities/v3/:entity/:uuid")
@ApiExtraModels(DemographicEntryDto)
export class EntityAssociationsController {
  constructor(private readonly entitiesService: EntitiesService, private readonly policyService: PolicyService) {}

  @Get(":association")
  async associationIndex(@Param() { entity, uuid, association }: EntityAssociationIndexParamsDto) {
    const processor = this.entitiesService.createAssociationProcessor(entity, uuid, association);
    const baseEntity = await processor.getBaseEntity();
    // TODO: implement read policies for all base entities
    await this.policyService.authorize("read", baseEntity);

    const document = buildJsonApi(processor.DTO, { forceDataArray: true });
    await processor.addDtos(document);
    return document.serialize();
  }
}
