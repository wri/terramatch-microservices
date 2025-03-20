import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ANRDto, ProjectApplicationDto, ProjectFullDto, ProjectLightDto } from "./dto/project.dto";
import { SpecificEntityDto } from "./dto/specific-entity.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { SiteFullDto, SiteLightDto } from "./dto/site.dto";
import { EntityIndexParamsDto } from "./dto/entity-index-params.dto";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { MediaDto } from "./dto/media.dto";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";

@Controller("entities/v3")
@ApiExtraModels(ANRDto, ProjectApplicationDto, MediaDto)
export class EntitiesController {
  constructor(private readonly policyService: PolicyService, private readonly entitiesService: EntitiesService) {}

  @Get(":entity")
  @ApiOperation({
    operationId: "entityIndex",
    summary: "Get a paginated and filtered list of light entity resources."
  })
  @JsonApiResponse([
    { data: ProjectLightDto, pagination: "number" },
    { data: SiteLightDto, pagination: "number" }
  ])
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async entityIndex<T extends EntityModel>(@Param() { entity }: EntityIndexParamsDto, @Query() query: EntityQueryDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const { models, paginationTotal } = await processor.findMany(
      query,
      this.policyService.userId,
      await this.policyService.getPermissions()
    );

    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });
    if (models.length !== 0) {
      await this.policyService.authorize("read", models);

      // Unfortunately, order matters on these returned documents, so we have to wait for each
      // build individually. Typically, light DTO processing shouldn't require additional queries
      // though, so this probably doesn't matter in the end.
      for (const model of models) {
        await processor.addLightDto(document, model);
      }
    }

    return document.serialize({ paginationTotal, pageNumber: query.page?.number });
  }

  @Get(":entity/:uuid")
  @ApiOperation({
    operationId: "entityGet",
    summary: "Get a single full entity resource by UUID"
  })
  @JsonApiResponse([ProjectFullDto, SiteFullDto])
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async entityGet<T extends EntityModel>(@Param() { entity, uuid }: SpecificEntityDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("read", model);

    const document = buildJsonApi(processor.FULL_DTO);
    await processor.addFullDto(document, model);
    return document.serialize();
  }

  @Delete(":entity/:uuid")
  @ApiOperation({
    operationId: "entityDelete",
    summary:
      "Soft delete entity resource by UUID. For non-admins / project managers, only entities with " +
      '"started" status may be deleted. Additionally, reports may only be deleted by admins.'
  })
  @JsonApiDeletedResponse([getDtoType(ProjectFullDto), getDtoType(SiteFullDto)], {
    description: "Associated entity was deleted"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async entityDelete<T extends EntityModel>(@Param() { entity, uuid }: SpecificEntityDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("delete", model);

    await processor.delete(model);

    return buildDeletedResponse(getDtoType(processor.FULL_DTO), model.uuid);
  }
}
