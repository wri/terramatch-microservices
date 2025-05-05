import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Request
} from "@nestjs/common";
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
  async getPitches(@Request() { authenticatedUserId }, @Query() params: ProjectsPitchesParamDto) {
    const { data, paginationTotal, pageNumber } = await this.projectPitchService.getProjectPitches(
      authenticatedUserId,
      params
    );
    const document = buildJsonApi(ProjectPitchDto, { forceDataArray: true });
    const indexIds: string[] = [];
    for (const pitch of data) {
      indexIds.push(pitch.uuid);
      const pitchDto = new ProjectPitchDto(pitch);
      document.addData(pitchDto.uuid, pitchDto);
    }

    document.addIndexData({
      resource: "projectPitches",
      requestPath: `/entities/v3/projectPitches`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
    return document.serialize();
  }

  @Get("/admin")
  @ApiOperation({
    operationId: "AdminProjectPitchesIndex",
    summary: "Get admin projects pitches."
  })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async getAdminPitches(@Query() params: ProjectsPitchesParamDto) {
    const { data, paginationTotal, pageNumber } = await this.projectPitchService.getAdminProjectPitches(params);
    const document = buildJsonApi(ProjectPitchDto, { forceDataArray: true });
    const indexIds: string[] = [];
    for (const pitch of data) {
      indexIds.push(pitch.uuid);
      const pitchDto = new ProjectPitchDto(pitch);
      document.addData(pitchDto.uuid, pitchDto);
    }
    document.addIndexData({
      resource: "projectPitches",
      requestPath: `/entities/v3/projectPitches/admin`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
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
