import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
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
import { SiteReportLightDto, SiteReportFullDto } from "./dto/site-report.dto";
import { Response as ExpressResponse } from "express";
import { PdfProcessor } from "./processors/pdf.processor";

@Controller("entities/v3")
@ApiExtraModels(ANRDto, ProjectApplicationDto, MediaDto, EntitySideload)
export class EntitiesController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly entitiesService: EntitiesService,
    private readonly pdfProcessor: PdfProcessor
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
    { data: SiteReportLightDto, pagination: "number" }
  ])
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async entityIndex<T extends EntityModel>(@Param() { entity }: EntityIndexParamsDto, @Query() query: EntityQueryDto) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });
    await processor.addIndex(document, query);
    return document.serialize();
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
    SiteReportFullDto
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

    const document = buildJsonApi(processor.FULL_DTO);
    const { id, dto } = await processor.getFullDto(model);
    document.addData(id, dto);
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

  @Get(":entity/:uuid/pdf")
  @ApiOperation({
    operationId: "entityPdf",
    summary: "Generate a PDF report for the entity"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Entity type does not support PDF generation." })
  async entityPdf(@Param() { entity, uuid }: SpecificEntityDto, @Res() res: ExpressResponse) {
    if (entity !== "projects") {
      throw new BadRequestException("PDF generation is only supported for projects at this time");
    }

    try {
      const pdfBuffer = await this.pdfProcessor.generateProjectPdf(uuid);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${uuid}-report.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);

      return res.send(pdfBuffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to generate PDF: ${error.message}`);
    }
  }
}
