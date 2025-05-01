import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { ProjectPitchService } from "./project-pitch.service";
import { ProjectPitchDto } from "./dto/project-pitch.dto";
import { ProjectPitchParamDto } from "./dto/project-pitch-param.dto";

@Controller("entities/v3/projectPitches")
export class ProjectPitchesController {
  constructor(
    private readonly projectPitchService: ProjectPitchService,
    private readonly policyService: PolicyService
  ) {}

  @Get(":uuid")
  @ApiOperation({
    operationId: "ProjectPitchesGetUUIDIndex",
    summary: "Get an project pitch by uuid."
  })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Project pitch not found" })
  async getByUUID(@Param() { uuid }: ProjectPitchParamDto) {
    const result = await this.projectPitchService.getProjectPitch(uuid);
    return buildJsonApi(ProjectPitchDto).addData(uuid, new ProjectPitchDto(result)).document.serialize();
  }

  @Get()
  @ApiOperation({
    operationId: "ProjectPitchesIndex",
    summary: "Get projects pitches."
  })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async getPitches() {
    const result = await this.projectPitchService.getProjectPitches();
    return buildJsonApi(ProjectPitchDto, { forceDataArray: true }).addData("dummy", result).document.serialize();
  }
}
