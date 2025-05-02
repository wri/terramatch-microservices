import { BadRequestException, Controller, Get, HttpStatus, NotFoundException, Param, Request } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ProjectPitchService } from "./project-pitch.service";
import { ProjectPitchDto } from "./dto/project-pitch.dto";
import { ProjectPitchParamDto } from "./dto/project-pitch-param.dto";
import { ProjectsPitchesParamDto } from "./dto/projects-pitches-param.dto";

@Controller("entities/v3/projectPitches")
export class ProjectPitchesController {
  constructor(
    private readonly projectPitchService: ProjectPitchService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "ProjectPitchesIndex",
    summary: "Get projects pitches."
  })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async getPitches(@Request() { authenticatedUserId }, @Param() { perPage, search }: ProjectsPitchesParamDto) {
    const result = await this.projectPitchService.getProjectPitches(authenticatedUserId);
    const document = buildJsonApi(ProjectPitchDto, { forceDataArray: true });
    for (const pitch of result) {
      const pitchDto = new ProjectPitchDto(pitch);
      document.addData(pitchDto.uuid, pitchDto);
    }
    return document.serialize();
  }

  @Get("/admin")
  @ApiOperation({
    operationId: "AdminProjectPitchesIndex",
    summary: "Get admin projects pitches."
  })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async getAdminPitches() {
    const result = await this.projectPitchService.getAdminProjectPitches();
    const document = buildJsonApi(ProjectPitchDto, { forceDataArray: true });
    for (const pitch of result) {
      const pitchDto = new ProjectPitchDto(pitch);
      document.addData(pitchDto.uuid, pitchDto);
    }
    return document.serialize();
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "ProjectPitchesGetUUIDIndex",
    summary: "Get an project pitch by uuid."
  })
  @JsonApiResponse(ProjectPitchDto, { status: HttpStatus.OK })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Project pitch not found" })
  async getByUUID(@Param() { uuid }: ProjectPitchParamDto) {
    const result = await this.projectPitchService.getProjectPitch(uuid);
    return buildJsonApi(ProjectPitchDto).addData(uuid, new ProjectPitchDto(result)).document.serialize();
  }
}
