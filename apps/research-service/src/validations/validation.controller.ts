import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Request
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { ValidationRequestBody } from "./dto/validation-request.dto";
import { ValidationSummaryDto } from "./dto/validation-summary.dto";
import { SiteValidationRequestBody } from "./dto/site-validation-request.dto";
import { GeometryValidationRequestBody } from "./dto/geometry-validation-request.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, buildDelayedJobResponse, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";
import {
  CriteriaId,
  NON_PERSISTENT_VALIDATION_TYPES,
  VALIDATION_TYPES
} from "@terramatch-microservices/database/constants";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJob, Site } from "@terramatch-microservices/database/entities";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";

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

    if (criteriaId != null && (criteriaId < 1 || !Number.isInteger(criteriaId))) {
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
  async createPolygonValidations(@Body() payload: ValidationRequestBody) {
    const request = payload.data.attributes;

    const validationTypes =
      request.validationTypes == null || request.validationTypes.length === 0
        ? [...VALIDATION_TYPES]
        : request.validationTypes;

    await this.validationService.validatePolygonsBatch(request.polygonUuids, validationTypes);

    const document = buildJsonApi(ValidationDto);

    for (const polygonUuid of request.polygonUuids) {
      const validation = await this.validationService.getPolygonValidation(polygonUuid);
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
  async createSiteValidation(
    @Param("siteUuid") siteUuid: string,
    @Body() payload: SiteValidationRequestBody,
    @Request() { authenticatedUserId }
  ) {
    const request = payload.data.attributes;

    const polygonUuids = await this.validationService.getSitePolygonUuids(siteUuid);

    if (polygonUuids.length === 0) {
      throw new NotFoundException(`No polygons found for site ${siteUuid}`);
    }

    const site = await Site.findOne({
      where: { uuid: siteUuid },
      attributes: ["id", "name"]
    });

    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    const validationTypes =
      request.validationTypes == null || request.validationTypes.length === 0
        ? VALIDATION_TYPES
        : request.validationTypes;

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Validation",
      totalContent: polygonUuids.length,
      processedContent: 0,
      progressMessage: "Starting validation...",
      createdBy: authenticatedUserId,
      metadata: {
        entity_id: site.id,
        entity_type: Site.LARAVEL_TYPE,
        entity_name: site.name
      }
    } as DelayedJob);

    await this.validationQueue.add("siteValidation", {
      siteUuid,
      validationTypes,
      delayedJobId: delayedJob.id
    });

    return buildDelayedJobResponse(delayedJob);
  }

  @Post("geometries")
  @ApiOperation({
    operationId: "validateGeometries",
    summary: "Validate raw GeoJSON geometries without persistence",
    description: `Validates raw GeoJSON geometries in-memory without persisting results to the database.
    
    This endpoint is useful for validating geometries before creating site polygons, allowing you to check
    for issues without saving the data.
    
    Input:
    - Provide an array of GeoJSON FeatureCollections containing the geometries to validate
    - Optionally specify which validation types to run (defaults to all non-persistent validation types)
    
    Supported validation types (non-persistent):
    - SELF_INTERSECTION: Checks if polygon edges intersect with themselves
    - POLYGON_SIZE: Validates polygon area is within acceptable range ( 1000 ha )
    - SPIKES: Detects spikes in polygon boundaries
    - DUPLICATE_GEOMETRY: Checks if geometry already exists (requires siteId or site_id in feature properties)
    - DATA_COMPLETENESS: Validates required properties are present
    - FEATURE_BOUNDS: Validates geometry coordinates are within valid bounds
    - GEOMETRY_TYPE: Validates geometry type is supported (multipolygon, polygon or point)
    
    Response:
    - Returns a JSON:API document with validation results in the \`data\` array
    - Each validation result contains a \`polygonUuid\` identifier (from feature properties.id if provided, otherwise auto-generated as "feature-{index}")
    - This identifier is NOT a database UUID - it's only used to match validation results back to the input features
    - Each result includes a \`criteriaList\` with validation details for each criteria checked
    - Results are not persisted to the database and are only returned in the response
    
    Note: For duplicate geometry validation, features must include \`siteId\`in their properties.
    
    Property naming: GeoJSON properties support both camelCase and snake_case.
    camelCase takes precedence if both formats are present for the same property.`
  })
  @JsonApiResponse(ValidationDto)
  @ExceptionResponse(BadRequestException, {
    description: "Invalid validation request or malformed GeoJSON"
  })
  async validateGeometries(@Body() payload: GeometryValidationRequestBody) {
    const request = payload.data.attributes;

    const validationTypes =
      request.validationTypes == null || request.validationTypes.length === 0
        ? [...NON_PERSISTENT_VALIDATION_TYPES]
        : request.validationTypes;

    const validations = await this.validationService.validateGeometries(request.geometries, validationTypes);

    const document = buildJsonApi(ValidationDto);

    for (const validation of validations) {
      const criteriaList: ValidationCriteriaDto[] = validation.attributes.criteriaList.map(criteria => ({
        criteriaId: criteria.criteriaId,
        validationType: criteria.validationType,
        valid: criteria.valid,
        createdAt: criteria.createdAt,
        extraInfo: criteria.extraInfo
      }));

      const validationDto = populateDto(new ValidationDto(), {
        polygonUuid: validation.attributes.polygonUuid,
        criteriaList
      });
      document.addData(validation.id, validationDto);
    }

    return document;
  }
}
