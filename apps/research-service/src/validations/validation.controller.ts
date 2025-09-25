import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Post, Body } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";

@Controller("validations/v3")
@ApiTags("Validations")
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

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

    const { validations, total } = await this.validationService.getSiteValidations(
      siteUuid,
      pageSize,
      pageNumber,
      query.criteriaId
    );

    return validations
      .reduce(
        (document, validation) => document.addData(validation.polygonId, validation).document,
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
    const validationResponse = await this.validationService.validatePolygons(request);

    const document = buildJsonApi(ValidationDto);

    const resultsByPolygon = new Map<string, ValidationCriteriaDto[]>();

    for (const result of validationResponse.results) {
      if (result.polygonUuid != null) {
        if (!resultsByPolygon.has(result.polygonUuid)) {
          resultsByPolygon.set(result.polygonUuid, []);
        }
        const criteriaList = resultsByPolygon.get(result.polygonUuid);
        if (criteriaList != null) {
          criteriaList.push(result);
        }
      }
    }

    for (const [polygonUuid, criteriaList] of resultsByPolygon) {
      const validation = new ValidationDto();
      validation.polygonId = polygonUuid;
      validation.criteriaList = criteriaList;
      document.addData(polygonUuid, validation);
    }

    return document;
  }
}
