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
  UnauthorizedException
} from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FormFullDto, FormLightDto, Forms, CreateFormBody, UpdateFormBody } from "./dto/form.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { FormsService } from "./forms.service";
import { FormGetQueryDto, FormIndexQueryDto } from "./dto/form-query.dto";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { PolicyService } from "@terramatch-microservices/common";
import { Form } from "@terramatch-microservices/database/entities";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { FormTranslationDto } from "@terramatch-microservices/common/dto/form-translation.dto";

@Controller("forms/v3/forms")
@ApiExtraModels(Forms)
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly policyService: PolicyService,
    private readonly localizationService: LocalizationService
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
  @ExceptionResponse(BadRequestException, { description: "Locale for authenticated user missing" })
  async get(@Param("uuid") uuid: string, @Query() query: FormGetQueryDto) {
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
  async delete(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    await this.policyService.authorize("delete", form);
    if (form.published) {
      throw new BadRequestException("Published forms may not be deleted");
    }

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
    return await this.formsService.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form, false);
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
    return await this.formsService.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form, false);
  }

  @Post(":uuid/translations")
  @ApiOperation({ operationId: "formPushTranslation", description: "Push translations to Transifex for a form" })
  @ExceptionResponse(UnauthorizedException, { description: "Form translation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Form payload malformed." })
  @ExceptionResponse(NotFoundException, { description: "Form not found." })
  async pushFormTranslation(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    await this.policyService.authorize("update", form);
    const i18nItemIds = await this.formsService.getI18nIdsForForm(form);
    await this.localizationService.pushTranslationByForm(form, i18nItemIds);
    return this.localizationService.addTranslationDto(
      buildJsonApi<FormTranslationDto>(FormTranslationDto),
      i18nItemIds
    );
  }

  @Get(":uuid/translations")
  @ApiOperation({ operationId: "formPullTranslations", description: "Pull translations from Transifex for a form" })
  @ExceptionResponse(UnauthorizedException, { description: "Form translation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Form payload malformed." })
  @ExceptionResponse(NotFoundException, { description: "Form not found." })
  async pullFormTranslation(@Param("uuid") uuid: string) {
    const form = await this.formsService.findOne(uuid);
    await this.policyService.authorize("update", form);
    const i18nItemIds = await this.localizationService.pullTranslations({ filterTags: form.uuid });
    return this.localizationService.addTranslationDto(
      buildJsonApi<FormTranslationDto>(FormTranslationDto),
      i18nItemIds
    );
  }
}
