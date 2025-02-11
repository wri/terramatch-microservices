import {
  Controller,
  Get,
  NotFoundException,
  NotImplementedException,
  Param,
  UnauthorizedException
} from "@nestjs/common";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ANRDto, ProjectFullDto } from "./dto/project.dto";
import { EntityGetParamsDto } from "./dto/entity-get-params.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("entities/v3")
@ApiExtraModels(ANRDto)
export class EntitiesController {
  constructor(private readonly policyService: PolicyService, private readonly entitiesService: EntitiesService) {}

  @Get(":entity/:uuid")
  @ApiOperation({
    operationId: "entityGet",
    summary: "Get a single full entity resource by UUID"
  })
  @JsonApiResponse({ data: { type: ProjectFullDto } })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async entityGet(@Param() { entity, uuid }: EntityGetParamsDto) {
    if (entity !== "projects") {
      throw new NotImplementedException(`Entity type not yet implemented in this service: ${entity}`);
    }

    const processor = this.entitiesService.createProcessor(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("read", model);

    const document = buildJsonApi();
    await processor.addFullDto(document, model);
    return document.serialize();
  }
}
