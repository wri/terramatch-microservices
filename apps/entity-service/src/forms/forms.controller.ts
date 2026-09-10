import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { Response } from "express";
import { ApiExtraModels, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CreateFormBody, FormFullDto, FormLightDto, Forms, UpdateFormBody } from "./dto/form.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { FormsService } from "./forms.service";
import { FormIndexQueryDto } from "./dto/form-query.dto";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { PolicyService } from "@terramatch-microservices/common";
import { Form, FormSubmission } from "@terramatch-microservices/database/entities";

@Controller("forms/v3/forms")
@ApiExtraModels(Forms)
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "formIndex",
    description: "Get a paginated and filtered list of forms. Includes all sections and questions within the form."
  })
  @JsonApiResponse({ data: FormLightDto, pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: FormIndexQueryDto) {
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
  async get(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    return await this.formsService.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form);
  }

  @Delete(":uuid")
  @ApiOperation({ operationId: "formDelete", summary: "Soft delete form by UUID" })
  @JsonApiDeletedResponse(getDtoType(FormFullDto), { description: "Associated form was deleted" })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource is unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Form not found." })
  async delete(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    await this.policyService.authorize("delete", form);

    await form.destroy();
    return buildDeletedResponse(getDtoType(FormFullDto), uuid);
  }

  @Post()
  @ApiOperation({ operationId: "formCreate", description: "Create a new form" })
  @JsonApiResponse(FormFullDto)
  @ExceptionResponse(UnauthorizedException, { description: "Form creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Form payload malformed." })
  async create(@Body() payload: CreateFormBody) {
    await this.policyService.authorize("create", Form);

    const form = await this.formsService.store(payload.data.attributes);
    return await this.formsService.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form);
  }

  // Using PUT instead of PATCH because if a question or section is left out of the attributes, it
  // is removed from the form. PUT is the correct method for this mechanic.
  @Put(":uuid")
  @ApiOperation({ operationId: "formUpdate", description: "Update a form" })
  @JsonApiResponse(FormFullDto)
  @ExceptionResponse(UnauthorizedException, { description: "Form update not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Form payload malformed." })
  @ExceptionResponse(NotFoundException, { description: "Form not found." })
  async update(@Param("uuid") uuid: string, @Body() payload: UpdateFormBody) {
    if (uuid !== payload.data.id) {
      throw new BadRequestException("Form id in path and payload do not match");
    }

    const form = await this.formsService.findOne(uuid);
    await this.policyService.authorize("update", form);
    await this.formsService.store(payload.data.attributes, form);
    return await this.formsService.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form);
  }

  @Get(":uuid/exportSubmissions")
  @ApiOperation({
    operationId: "formSubmissionsExportCsv",
    summary: "Export form submissions as CSV for a given form"
  })
  @ApiResponse({
    status: 200,
    description: "CSV file",
    content: { "text/csv": { schema: { type: "string" } } }
  })
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  async exportSubmissionsCsv(@Param("uuid") uuid: string, @Res() response: Response) {
    await this.policyService.authorize("read", FormSubmission);
    await this.formsService.exportSubmissions(uuid, response);
  }
}
