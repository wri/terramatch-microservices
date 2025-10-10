import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Post, Body } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { ValidationSummaryDto } from "./dto/validation-summary.dto";
import { SiteValidationRequestDto } from "./dto/site-validation-request.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";
import { CriteriaId, VALIDATION_TYPES } from "@terramatch-microservices/database/constants";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@Controller("validations/v3")
@ApiTags("Validations")
export class ValidationController {
  constructor(
    private readonly validationService: ValidationService,
    @InjectQueue("validation") private readonly validationQueue: Queue
  ) {}

  @Get("polygons/:polygonUuid")
  @ApiOperation({
    operationId: "getPolygonValidation",
    summary: "Get validation data for a single polygon"
  })
  @JsonApiResponse(ValidationDto)
  @ExceptionResponse(NotFoundException, {
    description: "Polygon not found"
  })
  async getPolygonValidation(@Param("polygonUuid") polygonUuid: string) {
    const validation = await this.validationService.getPolygonValidation(polygonUuid);
    return buildJsonApi(ValidationDto).addData(polygonUuid, validation);
  }

  @Get("sites/:siteUuid")
  @ApiOperation({
    operationId: "getSiteValidation",
    summary: "Get validation data for all polygons in a site"
  })
  @JsonApiResponse(ValidationDto)
  @ExceptionResponse(NotFoundException, {
    description: "Site not found or has no polygons"
  })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid pagination parameters"
  })
  async getSiteValidation(@Param("siteUuid") siteUuid: string, @Query() query: SiteValidationQueryDto) {
    const pageSize = query.page?.size ?? MAX_PAGE_SIZE;
    const pageNumber = query.page?.number ?? 1;

    const criteriaId = query.criteriaId != null ? (Number(query.criteriaId) as CriteriaId) : undefined;

    if (criteriaId != null && (criteriaId < 1 || Number.isInteger(criteriaId) === false)) {
      throw new BadRequestException("criteriaId must be a valid integer greater than or equal to 1");
    }

    const { validations, total } = await this.validationService.getSiteValidations(
      siteUuid,
      pageSize,
      pageNumber,
      criteriaId
    );

    return validations
      .reduce(
        (document, validation) => document.addData(validation.polygonUuid, validation).document,
        buildJsonApi(ValidationDto)
      )
      .addIndex({
        requestPath: `/validations/v3/sites/${siteUuid}${getStableRequestQuery(query)}`,
        total,
        pageNumber
      });
  }

  @Post("polygonValidations")
  @ApiOperation({
    operationId: "createPolygonValidations",
    summary: "Validate multiple polygons for various criteria"
  })
  @JsonApiResponse(ValidationDto)
  @ExceptionResponse(NotFoundException, {
    description: "One or more polygons not found"
  })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid validation request"
  })
  async createPolygonValidations(@Body() request: ValidationRequestDto) {
    const validationTypes = request.validationTypes ?? [...VALIDATION_TYPES];

    const validationResponse = await this.validationService.validatePolygons({
      ...request,
      validationTypes
    });

    const document = buildJsonApi(ValidationDto);

    const resultsByPolygon = new Map<string, ValidationCriteriaDto[]>();

    for (let i = 0; i < request.polygonUuids.length; i++) {
      const polygonUuid = request.polygonUuids[i];
      const polygonResults: ValidationCriteriaDto[] = [];
      const startIdx = i * validationTypes.length;
      const endIdx = startIdx + validationTypes.length;

      for (let j = startIdx; j < endIdx && j < validationResponse.results.length; j++) {
        polygonResults.push(validationResponse.results[j]);
      }

      if (polygonResults.length > 0) {
        resultsByPolygon.set(polygonUuid, polygonResults);
      }
    }

    for (const [polygonUuid, criteriaList] of resultsByPolygon) {
      const validation = new ValidationDto();
      validation.polygonUuid = polygonUuid;
      validation.criteriaList = criteriaList;
      document.addData(polygonUuid, validation);
    }

    return document;
  }

  @Post("sites/:siteUuid/validation")
  @ApiOperation({
    operationId: "createSiteValidation",
    summary: "Start asynchronous validation for all polygons in a site"
  })
  @JsonApiResponse([ValidationSummaryDto, DelayedJobDto])
  @ExceptionResponse(NotFoundException, {
    description: "Site not found or has no polygons"
  })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid validation request"
  })
  async createSiteValidation(@Param("siteUuid") siteUuid: string, @Body() request: SiteValidationRequestDto) {
    const polygonUuids = await this.validationService.getSitePolygonUuids(siteUuid);

    if (polygonUuids.length === 0) {
      throw new NotFoundException(`No polygons found for site ${siteUuid}`);
    }

    const validationTypes = request.validationTypes ?? VALIDATION_TYPES;

    const delayedJob = await DelayedJob.create();
    delayedJob.name = "Site Polygon Validation";
    delayedJob.totalContent = polygonUuids.length;
    delayedJob.processedContent = 0;
    delayedJob.progressMessage = "Starting validation...";
    delayedJob.metadata = {
      entity_name: `Site Validation (${polygonUuids.length} polygons)`
    };
    await delayedJob.save();

    await this.validationQueue.add("siteValidation", {
      siteUuid,
      validationTypes,
      delayedJobId: delayedJob.id
    });

    const delayedJobDto = populateDto(new DelayedJobDto(), delayedJob);
    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, delayedJobDto);
  }
}
