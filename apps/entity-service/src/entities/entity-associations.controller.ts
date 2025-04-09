import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { DemographicCollections, DemographicDto, DemographicEntryDto } from "./dto/demographic.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { SeedingDto } from "./dto/seeding.dto";
import { TreeSpeciesDto } from "./dto/tree-species.dto";
import { MediaDto } from "./dto/media.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
@Controller("entities/v3/:entity/:uuid")
@ApiExtraModels(DemographicEntryDto, DemographicCollections)
export class EntityAssociationsController {
  private readonly logger = new TMLogger(EntityAssociationsController.name);
  constructor(private readonly entitiesService: EntitiesService, private readonly policyService: PolicyService) {}

  @Get(":association")
  @ApiOperation({
    operationId: "entityAssociationIndex",
    summary: "Get all of a single type of association that are related to a given entity."
  })
  @JsonApiResponse([
    { data: DemographicDto, hasMany: true },
    { data: SeedingDto, hasMany: true },
    { data: TreeSpeciesDto, hasMany: true }
    // TODO: check why this is causing a TypeError
    // { data: MediaDto, hasMany: true }
  ])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Base entity not found" })
  async associationIndex(@Param() { entity, uuid, association }: EntityAssociationIndexParamsDto) {
    const processor = this.entitiesService.createAssociationProcessor(entity, uuid, association);
    const baseEntity = await processor.getBaseEntity();
    await this.policyService.authorize("read", baseEntity);
    let document: DocumentBuilder;
    this.logger.log(processor.DTO);
    if (processor.DTO === MediaDto) {
      // TODO: check why this is causing a TypeError
      document = buildJsonApi(processor.DTO, { forceDataArray: true });
    } else {
      document = buildJsonApi(processor.DTO, { forceDataArray: true });
    }
    await processor.addDtos(document);
    return document.serialize();
  }
}
