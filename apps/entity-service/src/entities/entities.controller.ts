import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
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
import { EntityQueryDto, EntitySideload } from "./dto/entity-query.dto";
import { MediaDto } from "./dto/media.dto";
import { ProjectReportFullDto, ProjectReportLightDto } from "./dto/project-report.dto";
import { NurseryFullDto, NurseryLightDto } from "./dto/nursery.dto";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { NurseryReportFullDto, NurseryReportLightDto } from "./dto/nursery-report.dto";
import { SiteReportFullDto, SiteReportLightDto } from "./dto/site-report.dto";
import { EntityUpdateBody } from "./dto/entity-update.dto";
import { SupportedEntities } from "./dto/entity.dto";
import { FinancialReportLightDto, FinancialReportFullDto } from "./dto/financial-report.dto";
import { DisturbanceReportFullDto, DisturbanceReportLightDto } from "./dto/disturbance-report.dto";
import { EntityCreateBody } from "./dto/entity-create.dto";

@Controller("entities/v3")
@ApiExtraModels(ANRDto, ProjectApplicationDto, MediaDto, EntitySideload, SupportedEntities)
export class EntitiesController {
  constructor(private readonly policyService: PolicyService, private readonly entitiesService: EntitiesService) {}

  @Get(":entity")
  @ApiOperation({
    operationId: "entityIndex",
    summary: "Get a paginated and filtered list of light entity resources."
  })
  @JsonApiResponse([
    { data: ProjectLightDto, pagination: "number" },
    { data: SiteLightDto, pagination: "number" },
    { data: NurseryLightDto, pagination: "number" },
    { data: ProjectReportLightDto, pagination: "number" },
    { data: NurseryReportLightDto, pagination: "number" },
    { data: SiteReportLightDto, pagination: "number" },
    { data: FinancialReportLightDto, pagination: "number" },
    { data: DisturbanceReportLightDto, pagination: "number" }
  ])
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async entityIndex<T extends EntityModel>(@Param() { entity }: EntityIndexParamsDto, @Query() query: EntityQueryDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });
    await processor.addIndex(document, query);
    return document;
  }

  @Get(":entity/:uuid")
  @ApiOperation({
    operationId: "entityGet",
    summary: "Get a single full entity resource by UUID"
  })
  @JsonApiResponse([
    ProjectFullDto,
    SiteFullDto,
    NurseryFullDto,
    NurseryFullDto,
    ProjectReportFullDto,
    NurseryReportFullDto,
    SiteReportFullDto,
    FinancialReportFullDto,
    DisturbanceReportFullDto
  ])
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async entityGet<T extends EntityModel>(@Param() { entity, uuid }: SpecificEntityDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("read", model);

    const { id, dto } = await processor.getFullDto(model);
    return buildJsonApi(processor.FULL_DTO).addData(id, dto);
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

  @Patch(":entity/:uuid")
  @ApiOperation({
    operationId: "entityUpdate",
    summary: "Update various supported entity fields directly. Typically used for status transitions"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async entityUpdate<T extends EntityModel>(
    @Param() { entity, uuid }: SpecificEntityDto,
    @Body() updatePayload: EntityUpdateBody
  ) {
    // The structure of the EntityUpdateBody ensures that the `type` field in the body controls
    // which update body is used for validation, but it doesn't make sure that the body of the
    // request matches the type in the URL path.
    if (entity !== updatePayload.data.type) {
      throw new BadRequestException("Entity type in path and payload do not match");
    }
    if (uuid !== updatePayload.data.id) {
      throw new BadRequestException("Entity id in path and payload do not match");
    }

    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("update", model);

    await processor.update(model, updatePayload.data.attributes);

    const { id, dto } = await processor.getFullDto(model);
    return buildJsonApi(processor.FULL_DTO).addData(id, dto);
  }

  @Post(":entity")
  @ApiOperation({
    operationId: "entityCreate",
    summary: "Create a new entity resource"
  })
  @JsonApiResponse([DisturbanceReportFullDto])
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async entityCreate<T extends EntityModel>(
    @Param() { entity }: EntityIndexParamsDto,
    @Body() createPayload: EntityCreateBody
  ) {
    if (entity !== createPayload.data.type) {
      throw new BadRequestException("Entity type in path and payload do not match");
    }

    const processor = this.entitiesService.createEntityProcessor<T>(entity);

    const model = await processor.create(createPayload.data.attributes);

    const { id, dto } = await processor.getFullDto(model);

    return buildJsonApi(processor.FULL_DTO).addData(id, dto);
  }
}
