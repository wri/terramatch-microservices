import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { FormDataDto, FormDataGetParamsDto } from "./dto/form-data.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("entities/v3/:entity/:uuid/formData")
export class FormDataController {
  constructor(private readonly entitiesService: EntitiesService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({ operationId: "formDataGet", summary: "Get form data for an entity." })
  @JsonApiResponse(FormDataDto)
  @ExceptionResponse(BadRequestException, { description: "Request params are invalid" })
  @ExceptionResponse(NotFoundException, { description: "Entity or associated form not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Current user is not authorized to access this resource" })
  async formDataGet(@Param() { entity, uuid }: FormDataGetParamsDto) {
    const processor = this.entitiesService.createEntityProcessor(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException(`Entity not found for uuid: ${uuid}`);

    await this.policyService.authorize("read", model);

    return buildJsonApi(FormDataDto).addData(`${entity}:${uuid}`, await processor.getFormDataDto(model));
  }
}
