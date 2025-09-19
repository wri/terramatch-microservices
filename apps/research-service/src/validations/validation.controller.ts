import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { isNumberPage } from "@terramatch-microservices/common/dto/page.dto";
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
    const page = query.page ?? {};
    page.size ??= MAX_PAGE_SIZE;

    const pageNumber = isNumberPage(page) ? page.number : 1;

    const { validations, total } = await this.validationService.getSiteValidations(
      siteUuid,
      page.size,
      pageNumber,
      query.criteriaId
    );

    const document = buildJsonApi(ValidationDto);

    for (const validation of validations) {
      document.addData(validation.polygonId, validation);
    }

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
}
