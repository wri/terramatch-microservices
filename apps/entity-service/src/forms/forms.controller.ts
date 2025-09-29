import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FormDto, FormLightDto } from "./dto/form.dto";
import { FormQuestionDto } from "./dto/form-question.dto";
import { FormSectionDto } from "./dto/form-section.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { FormsService } from "./forms.service";
import { FormQueryDto } from "./dto/form-query.dto";

// TODO (NJC): Specs for this controller before epic TM-2411 is merged
@Controller("forms/v3/forms")
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @ApiOperation({
    operationId: "formIndex",
    description: "Get a paginated and filtered list of forms. Includes all sections and questions within the form."
  })
  @JsonApiResponse({ data: FormLightDto, included: [FormSectionDto, FormQuestionDto], pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async formIndex(@Query() query: FormQueryDto) {
    return await this.formsService.addIndex(buildJsonApi<FormLightDto>(FormLightDto, { pagination: "number" }), query);
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "formGet",
    description: "Get a form by uuid. Includes all sections and questions within the form."
  })
  @ApiParam({ name: "uuid", type: String, description: "Form uuid" })
  @JsonApiResponse({ data: FormDto, included: [FormSectionDto, FormQuestionDto] })
  @ExceptionResponse(NotFoundException, { description: "Form not found" })
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async formGet(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    return await this.formsService.addFullDto(buildJsonApi<FormDto>(FormDto), form);
  }
}
