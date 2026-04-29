import { Response } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ANRDto, ProjectApplicationDto, ProjectFullDto, ProjectLightDto } from "./dto/project.dto";
import { SpecificEntityDto } from "./dto/specific-entity.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { SiteFullDto, SiteLightDto } from "./dto/site.dto";
import { EntityIndexParamsDto } from "./dto/entity-index-params.dto";
import { EntityQueryDto, EntitySideload } from "./dto/entity-query.dto";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { ProjectReportFullDto, ProjectReportLightDto } from "./dto/project-report.dto";
import { NurseryFullDto, NurseryLightDto } from "./dto/nursery.dto";
import {
  CACHED_EXPORT_ENTITY_TYPES,
  ENTITY_MODELS,
  EntityModel
} from "@terramatch-microservices/database/constants/entities";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { NurseryReportFullDto, NurseryReportLightDto } from "./dto/nursery-report.dto";
import { SiteReportFullDto, SiteReportLightDto } from "./dto/site-report.dto";
import { EntityUpdateBody } from "./dto/entity-update.dto";
import { SupportedEntities } from "./dto/entity.dto";
import { FinancialReportFullDto, FinancialReportLightDto } from "./dto/financial-report.dto";
import { DisturbanceReportFullDto, DisturbanceReportLightDto } from "./dto/disturbance-report.dto";
import { EntityCreateBody } from "./dto/entity-create.dto";
import { SrpReportFullDto, SrpReportLightDto } from "./dto/srp-report.dto";
import { EntityExportQueryDto } from "./dto/entity-export-query.dto";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";
import { kebabCase } from "lodash";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { DelayedJobDto } from "@terramatch-microservices/common/dto";
import { ENTITY_SERVICE_EXPORT_QUEUE, EntityServiceExportsProcessor } from "../jobs/entity-service-exports.processor";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { Project } from "@terramatch-microservices/database/entities";

@Controller("entities/v3")
@ApiExtraModels(ANRDto, ProjectApplicationDto, MediaDto, EntitySideload, SupportedEntities)
export class EntitiesController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly entitiesService: EntitiesService,
    private readonly csvExportService: CsvExportService,
    @InjectQueue(ENTITY_SERVICE_EXPORT_QUEUE) private readonly exportQueue: Queue
  ) {}

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
    { data: DisturbanceReportLightDto, pagination: "number" },
    { data: SrpReportLightDto, pagination: "number" }
  ])
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async entityIndex<T extends EntityModel>(@Param() { entity }: EntityIndexParamsDto, @Query() query: EntityQueryDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });
    await processor.addIndex(document, query);
    return document;
  }

  @Get(":entity/exportAll")
  @ApiOperation({
    operationId: "entityExportAll",
    summary: "Export all of a given entity as CSV."
  })
  @JsonApiResponse(FileDownloadDto)
  @ApiResponse({
    status: 200,
    description: "CSV file",
    content: { "text/csv": { schema: { type: "string" } } }
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  async entityExportAll<T extends EntityModel>(
    @Param() { entity }: EntityIndexParamsDto,
    @Query() { frameworkKey, projectUuid }: EntityExportQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // if we're some kind of admin and we have a framework key set, the intention is to access the
    // automatically generated reports that are sent to S3.
    if (
      CACHED_EXPORT_ENTITY_TYPES.includes(entity) &&
      frameworkKey != null &&
      this.policyService.permissions.find(p => p.startsWith("framework-")) != null
    ) {
      // These reports are generated twice a day and stored in S3
      await this.policyService.authorize("exportAll", ENTITY_MODELS[entity].build({ frameworkKey }));
      const fileName = `all-entity-records/${kebabCase(entity)}-${frameworkKey}.csv`;
      const dto = await this.csvExportService.generateExportDto(fileName);
      return buildJsonApi(FileDownloadDto).addData(`${entity}Export`, dto);
    }

    // Otherwise, we're either an admin accessing an entity type that isn't framework specific, or
    // we're a non-admin trying to get an export of all of the entities of this type we have access
    // to. Either way, it writes directly to the response, and the permissions are checked in
    // the processor.
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    await processor.exportAll({ target: response, frameworkKey, projectUuid });
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
    DisturbanceReportFullDto,
    SrpReportFullDto
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

  @Get(":entity/:uuid/export")
  @ApiOperation({
    operationId: "entityExport",
    summary: "Export a given entity as CSV or ZIP archive."
  })
  @JsonApiResponse([FileDownloadDto, DelayedJobDto])
  @ApiResponse({
    status: 200,
    description: "CSV file",
    content: { "text/csv": { schema: { type: "string" } } }
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  async entityExport<T extends EntityModel>(
    @Param() { entity, uuid }: SpecificEntityDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // All of our entity types generate quickly enough to do right on the response except for projects.
    // It just includes too much and needs to go to a delayed job.
    if (entity === "projects") {
      const project = await Project.findOne({
        where: { uuid },
        attributes: ["id", "organisationId", "frameworkKey", "name"]
      });
      if (project == null) throw new NotFoundException();
      if (project.frameworkKey == null) throw new InternalServerErrorException("Cannot export without a framework key");
      await this.policyService.authorize("read", project);

      return await EntityServiceExportsProcessor.queueProjectExport(this.exportQueue, uuid, project.name ?? "");
    }

    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    await processor.export(uuid, response);
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
