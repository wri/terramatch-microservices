import {
  Controller,
  Get,
  NotFoundException,
  NotImplementedException,
  Param,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { AdditionalProjectFullProps, ProjectFullDto } from "./dto/project.dto";
import { EntityGetParamsDto } from "./dto/entity-get-params.dto";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { Project } from "@terramatch-microservices/database/entities";

@Controller("entities/v3")
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

    const model = await this.entitiesService.getEntity(entity, uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("read", model);

    // TODO: this code is specific to projects.
    return buildJsonApi()
      .addData(model.uuid, new ProjectFullDto(model as Project, {} as AdditionalProjectFullProps))
      .document.serialize();
  }
}
