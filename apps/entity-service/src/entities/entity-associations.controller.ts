import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { DemographicCollections, DemographicDto, DemographicEntryDto } from "./dto/demographic.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";

@Controller("entities/v3/:entity/:uuid")
@ApiExtraModels(DemographicEntryDto, DemographicCollections)
export class EntityAssociationsController {
  constructor(private readonly entitiesService: EntitiesService, private readonly policyService: PolicyService) {}

  @Get(":association")
  @ApiOperation({
    operationId: "entityAssociationIndex",
    summary: "Get all of a single type of association that are related to a given entity."
  })
  @JsonApiResponse([DemographicDto])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Base entity not found" })
  async associationIndex(@Param() { entity, uuid, association }: EntityAssociationIndexParamsDto) {
    const processor = this.entitiesService.createAssociationProcessor(entity, uuid, association);
    const baseEntity = await processor.getBaseEntity();

    await this.policyService.authorize("read", baseEntity);

    const document = buildJsonApi(processor.DTO, { forceDataArray: true });
    await processor.addDtos(document);
    return document.serialize();
  }
}
