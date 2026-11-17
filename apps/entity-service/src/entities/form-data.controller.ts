import { Body, Controller, Get, NotFoundException, Param, Put, UnauthorizedException } from "@nestjs/common";
import { FormDataDto, FormDataParamsDto, UpdateFormDataBody } from "./dto/form-data.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { EntitiesService, ProcessableEntity } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { FormDataService } from "./form-data.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { AuditStatus, Form, Organisation } from "@terramatch-microservices/database/entities";
import { APPROVED, INFORMATION_REQUIRED } from "@terramatch-microservices/database/constants/status";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";

type FormDataTarget =
  { entity: "organisations"; model: Organisation } | { entity: ProcessableEntity; model: EntityModel };

@Controller("entities/v3/:entity/:uuid/formData")
export class FormDataController {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService,
    private readonly formDataService: FormDataService
  ) {}

  @Get()
  @ApiOperation({ operationId: "formDataGet", summary: "Get form data for an entity or organisation." })
  @JsonApiResponse(FormDataDto)
  @ExceptionResponse(BadRequestException, { description: "Request params are invalid" })
  @ExceptionResponse(NotFoundException, { description: "Entity or associated form not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current user is not authorized to access this resource" })
  async get(@Param() params: FormDataParamsDto) {
    const target = await this.findTarget(params);
    await this.policyService.authorize("read", target.model);

    const form = await this.findForm(target.model);
    return await this.buildFormData(target, form);
  }

  @Put()
  @ApiOperation({ operationId: "formDataUpdate", summary: "Update form data for an entity or organisation." })
  @JsonApiResponse(FormDataDto)
  @ExceptionResponse(BadRequestException, { description: "Request params are invalid" })
  @ExceptionResponse(NotFoundException, { description: "Entity or associated form not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current user is not authorized to access this resource" })
  async update(@Param() params: FormDataParamsDto, @Body() payload: UpdateFormDataBody) {
    if (payload.data.id !== `${params.entity}|${params.uuid}`) {
      throw new BadRequestException("Id in payload does not match entity and uuid from path");
    }

    const target = await this.findTarget(params);
    await this.policyService.authorize("update", target.model);

    const form = await this.findForm(target.model);
    const { answers } = payload.data.attributes;
    if (target.entity === "organisations") {
      await this.formDataService.storeOrganisationAnswers(target.model, form, answers);
    } else {
      const { model } = target;
      await this.formDataService.storeEntityAnswers(model, form, answers);

      const type =
        model.status === APPROVED || model.status === INFORMATION_REQUIRED ? "change-request-updated" : "updated";
      await AuditStatus.ensureRecentAudit(model, UserContext.authenticatedUserId, type);
    }

    return await this.buildFormData(target, form);
  }

  private async findTarget({ entity, uuid }: FormDataParamsDto): Promise<FormDataTarget> {
    if (entity === "organisations") {
      const model = await Organisation.findOne({ where: { uuid } });
      if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
      return { entity, model };
    }

    const model = await this.entitiesService.createEntityProcessor(entity).findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    return { entity, model };
  }

  private async findForm(model: EntityModel | Organisation) {
    const form = await Form.for(model).findOne();
    if (form == null) throw new NotFoundException("Form for entity not found");
    return form;
  }

  private async buildFormData(target: FormDataTarget, form: Form) {
    const dto =
      target.entity === "organisations"
        ? await this.formDataService.getDtoForOrganisation(target.model, form)
        : await this.formDataService.getDtoForEntity(target.entity, target.model, form);
    return buildJsonApi(FormDataDto).addData(`${target.entity}|${target.model.uuid}`, dto).document;
  }
}
