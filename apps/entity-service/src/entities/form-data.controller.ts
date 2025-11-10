import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { FormDataDto, FormDataGetParamsDto } from "./dto/form-data.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { FormDataService } from "./form-data.service";
import { EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { Form } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@Controller("entities/v3/:entity/:uuid/formData")
export class FormDataController {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService,
    private readonly formDataService: FormDataService
  ) {}

  @Get()
  @ApiOperation({ operationId: "formDataGet", summary: "Get form data for an entity." })
  @JsonApiResponse(FormDataDto)
  @ExceptionResponse(BadRequestException, { description: "Request params are invalid" })
  @ExceptionResponse(NotFoundException, { description: "Entity or associated form not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current user is not authorized to access this resource" })
  async formDataGet(@Param() { entity, uuid }: FormDataGetParamsDto) {
    const model = await this.entitiesService.createEntityProcessor(entity).findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    await this.policyService.authorize("read", model);

    const form = await this.formDataService.getForm(model);
    if (form == null) throw new NotFoundException("Form for entity not found");

    return this.addFormData(buildJsonApi(FormDataDto), model, entity, form);
  }

  private async addFormData(document: DocumentBuilder, model: EntityModel, entityType: EntityType, form: Form) {
    const formTitle = await this.formDataService.getFormTitle(form, await this.entitiesService.getUserLocale());
    return document.addData(
      `${entityType}:${model.uuid}`,
      populateDto(new FormDataDto(), {
        entityType,
        entityUuid: model.uuid,
        formUuid: form.uuid,
        formTitle,
        frameworkKey: model.frameworkKey,
        feedback: model.feedback,
        feedbackFields: model.feedbackFields,
        answers: await this.formDataService.getAnswers(form, { [entityType]: model })
      })
    ).document;
  }
}
