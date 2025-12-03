import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import {
  DemographicCollections,
  DemographicDto,
  DemographicEntryDto
} from "@terramatch-microservices/common/dto/demographic.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { SeedingDto } from "@terramatch-microservices/common/dto/seeding.dto";
import { TreeSpeciesDto } from "@terramatch-microservices/common/dto/tree-species.dto";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { MediaQueryDto } from "./dto/media-query.dto";
import { DisturbanceDto } from "@terramatch-microservices/common/dto/disturbance.dto";
import { InvasiveDto } from "@terramatch-microservices/common/dto/invasive.dto";
import { StrataDto } from "@terramatch-microservices/common/dto/strata.dto";

@Controller("entities/v3/:entity/:uuid")
@ApiExtraModels(DemographicEntryDto, DemographicCollections)
export class EntityAssociationsController {
  constructor(private readonly entitiesService: EntitiesService, private readonly policyService: PolicyService) {}

  @Get(":association")
  @ApiOperation({
    operationId: "entityAssociationIndex",
    summary: "Get all of a single type of association that are related to a given entity."
  })
  @JsonApiResponse([
    { data: DemographicDto, hasMany: true },
    { data: SeedingDto, hasMany: true },
    { data: TreeSpeciesDto, hasMany: true },
    { data: MediaDto, hasMany: true },
    { data: DisturbanceDto, hasMany: true },
    { data: InvasiveDto, hasMany: true },
    { data: StrataDto, hasMany: true }
  ])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Base entity not found" })
  async associationIndex(
    @Param() { entity, uuid, association }: EntityAssociationIndexParamsDto,
    @Query() query: MediaQueryDto
  ) {
    const processor = this.entitiesService.createAssociationProcessor(entity, uuid, association, query);
    const baseEntity = await processor.getBaseEntity();
    await this.policyService.authorize("read", baseEntity);
    const document = buildJsonApi(processor.DTO, { forceDataArray: true });
    await processor.addDtos(document);
    return document;
  }
}
