import { Body, Controller, Get, NotFoundException, Param, Patch, UnauthorizedException } from "@nestjs/common";
import { FormDataService } from "./form-data.service";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { UpdateRequestDto, UpdateRequestUpdateBody } from "./dto/update-request.dto";
import { Form, UpdateRequest } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { SpecificEntityDto } from "./dto/specific-entity.dto";
import { EntitiesService, ProcessableEntity } from "./entities.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";

@Controller("entities/v3/:entity/:uuid/updateRequest")
export class UpdateRequestsController {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService,
    private readonly formDataService: FormDataService
  ) {}

  @Get()
  @ApiOperation({ operationId: "updateRequestGet", summary: "Get update request for an entity." })
  @JsonApiResponse(UpdateRequestDto)
  @ExceptionResponse(NotFoundException, { description: "Update request or base entity not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current use is not authorized to access this resource" })
  async updateRequestGet(@Param() { entity, uuid }: SpecificEntityDto) {
    const { updateRequest, model, form } = await this.findUpdateRequest(entity, uuid);
    return await this.addDto(buildJsonApi(UpdateRequestDto), form, updateRequest, entity, model);
  }

  @Patch()
  @ApiOperation({ operationId: "updateRequestUpdate", summary: "Update update request for an entity." })
  @JsonApiResponse(UpdateRequestDto)
  @ExceptionResponse(NotFoundException, { description: "Update request or base entity not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current use is not authorized to access this resource" })
  @ExceptionResponse(BadRequestException, { description: "Payload is malformed" })
  async updateRequestUpdate(
    @Param() { entity, uuid }: SpecificEntityDto,
    @Body() updatePayload: UpdateRequestUpdateBody
  ) {
    if (updatePayload.data.type !== "updateRequests" || updatePayload.data.id !== uuid) {
      throw new BadRequestException("Payload type and ID do not match the request path");
    }

    const { updateRequest, model, form } = await this.findUpdateRequest(entity, uuid);

    const attributes = updatePayload.data.attributes;
    if (attributes.status != null) {
      await updateRequest.update({
        status: attributes.status,
        feedback: attributes.feedback,
        feedbackFields: attributes.feedbackFields
      });

      if (updateRequest.status === "approved") {
        await this.formDataService.storeEntityAnswers(model, form, updateRequest.content ?? {});
      }
    }

    return await this.addDto(buildJsonApi(UpdateRequestDto), form, updateRequest, entity, model);
  }

  private async findUpdateRequest(entity: ProcessableEntity, uuid: string) {
    const model = await this.entitiesService.createEntityProcessor(entity).findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    await this.policyService.authorize("approve", model);

    const updateRequest = await UpdateRequest.for(model).current().findOne();
    if (updateRequest == null) throw new NotFoundException(`Update request not found for uuid: ${uuid}`);

    const form = await this.formDataService.getForm(model);
    if (form == null) throw new NotFoundException(`Form not found for update request: ${uuid}`);

    return { updateRequest, model, form };
  }

  private async addDto(
    document: DocumentBuilder,
    form: Form,
    updateRequest: UpdateRequest,
    entity: ProcessableEntity,
    model: EntityModel
  ) {
    return document.addData(
      model.uuid,
      populateDto<UpdateRequestDto>(new UpdateRequestDto(), {
        formUuid: form.uuid,
        status: updateRequest.status,
        entityAnswers: await this.formDataService.getAnswers(form, { [entity]: model }),
        updateRequestAnswers: updateRequest.content ?? {}
      })
    );
  }
}
