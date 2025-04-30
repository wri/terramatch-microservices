import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { ProjectPitchService } from "./project-pitch.service";
import { ProjectPitchDto } from "./dto/project-pitch.dto";

@Controller("entities/v3/projectPitches")
export class ProjectPitchesController {
  constructor(
    private readonly projectPitchService: ProjectPitchService,
    private readonly policyService: PolicyService
  ) {}

  @Get(":uuid")
  @ApiOperation({
    operationId: "ProjectPitchesAssociationIndex",
    summary: "Get an project pitch by uuid."
  })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Base entity not found" })
  async getByUUID(@Param() { uuid }: EntityAssociationIndexParamsDto) {
    const result = await this.projectPitchService.getProjectPitch(uuid);

    return buildJsonApi(ProjectPitchDto).addData(uuid, result).document.serialize();
  }
}
