import { Body, Controller, Get, NotFoundException, Param, Put, UnauthorizedException } from "@nestjs/common";
import { FormDataDto, UpdateFormDataBody } from "./dto/form-data.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { FormDataService } from "./form-data.service";
import { EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { Form } from "@terramatch-microservices/database/entities";
import { SpecificEntityDto } from "./dto/specific-entity.dto";

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
  async formDataGet(@Param() { entity, uuid }: SpecificEntityDto) {
    const model = await this.entitiesService.createEntityProcessor(entity).findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    await this.policyService.authorize("read", model);

    const form = await Form.for(model).findOne();
    if (form == null) throw new NotFoundException("Form for entity not found");

    return this.addFormData(buildJsonApi(FormDataDto), model, entity, form);
  }

  @Put()
  @ApiOperation({ operationId: "formDataUpdate", summary: "Update form data for an entity." })
  @JsonApiResponse(FormDataDto)
  @ExceptionResponse(BadRequestException, { description: "Request params are invalid" })
  @ExceptionResponse(NotFoundException, { description: "Entity or associated form not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current user is not authorized to access this resource" })
  async formDataUpdate(@Param() { entity, uuid }: SpecificEntityDto, @Body() payload: UpdateFormDataBody) {
    if (payload.data.id !== `${entity}:${uuid}`) {
      throw new BadRequestException("Id in payload does not match entity and uuid from path");
    }

    const model = await this.entitiesService.createEntityProcessor(entity).findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    await this.policyService.authorize("update", model);

    const form = await Form.for(model).findOne();
    if (form == null) throw new NotFoundException("Form for entity not found");

    await this.formDataService.storeEntityAnswers(model, form, payload.data.attributes.answers);
    return this.addFormData(buildJsonApi(FormDataDto), model, entity, form);
  }

  private async addFormData(document: DocumentBuilder, entity: EntityModel, entityType: EntityType, form: Form) {
    const dto = await this.formDataService.getDtoForEntity(
      entityType,
      entity,
      form,
      await this.entitiesService.getUserLocale()
    );
    return document.addData(`${entityType}:${entity.uuid}`, dto).document;
  }
}
