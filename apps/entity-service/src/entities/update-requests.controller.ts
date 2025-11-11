import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { FormDataService } from "./form-data.service";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { UpdateRequestDto } from "./dto/update-request.dto";
import { UpdateRequest } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { SpecificEntityDto } from "./dto/specific-entity.dto";
import { EntitiesService } from "./entities.service";

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
    const model = await this.entitiesService.createEntityProcessor(entity).findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    // Direct update request access is only allowed for folks that can approve the base entity.
    await this.policyService.authorize("approve", model);

    const updateRequest = await UpdateRequest.for(model).current().findOne();
    if (updateRequest == null) throw new NotFoundException(`Update request not found for uuid: ${uuid}`);

    const form = await this.formDataService.getForm(model);
    if (form == null) throw new NotFoundException(`Form not found for update request: ${uuid}`);

    return buildJsonApi(UpdateRequestDto).addData(
      uuid,
      populateDto<UpdateRequestDto>(new UpdateRequestDto(), {
        formUuid: form.uuid,
        status: updateRequest.status,
        entityAnswers: await this.formDataService.getAnswers(form, { [entity]: model }),
        updateRequestAnswers: updateRequest.content ?? {}
      })
    );
  }
}
