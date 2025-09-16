import { Controller, Get, NotFoundException, Param, Post, Body } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { ValidationResponseDto } from "./dto/validation-response.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";

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

  @Post("validate")
  @ApiOperation({
    operationId: "validatePolygons",
    summary: "Validate multiple polygons for various criteria"
  })
  @JsonApiResponse(ValidationResponseDto)
  async validatePolygons(@Body() request: ValidationRequestDto): Promise<ValidationResponseDto> {
    return await this.validationService.validatePolygons(request);
  }
}
