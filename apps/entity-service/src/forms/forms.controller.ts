import { Controller, Delete, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FormFullDto, FormLightDto, Forms } from "./dto/form.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { FormsService } from "./forms.service";
import { FormGetQueryDto, FormIndexQueryDto } from "./dto/form-query.dto";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { PolicyService } from "@terramatch-microservices/common";

@Controller("forms/v3/forms")
@ApiExtraModels(Forms)
export class FormsController {
  constructor(private readonly formsService: FormsService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "formIndex",
    description: "Get a paginated and filtered list of forms. Includes all sections and questions within the form."
  })
  @JsonApiResponse({ data: FormLightDto, pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async formIndex(@Query() query: FormIndexQueryDto) {
    return await this.formsService.addIndex(buildJsonApi<FormLightDto>(FormLightDto, { pagination: "number" }), query);
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "formGet",
    description: "Get a form by uuid. Includes all sections and questions within the form."
  })
  @ApiParam({ name: "uuid", type: String, description: "Form uuid" })
  @JsonApiResponse({ data: FormFullDto })
  @ExceptionResponse(NotFoundException, { description: "Form not found" })
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async formGet(@Param("uuid") uuid: string, @Query() query: FormGetQueryDto) {
    const form = await this.formsService.findOne(uuid);
    return await this.formsService.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form, query.translated ?? true);
  }

  @Delete(":uuid")
  @ApiOperation({ operationId: "formDelete", summary: "Soft delete form by UUID" })
  @JsonApiDeletedResponse(getDtoType(FormFullDto), { description: "Associated form was deleted" })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource is unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Form not found." })
  @ExceptionResponse(BadRequestException, { description: "Form is not allowed to be deleted." })
  async formDelete(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    await this.policyService.authorize("delete", form);
    if (form.published) {
      throw new BadRequestException("Published forms may not be deleted");
    }

    await form.destroy();
    return buildDeletedResponse(getDtoType(FormFullDto), uuid);
  }
}
