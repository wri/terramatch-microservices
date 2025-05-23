import { BadRequestException, Controller, Get, HttpStatus, NotFoundException, Param, Query } from "@nestjs/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ProjectPitchService } from "./project-pitch.service";
import { ProjectPitchDto } from "./dto/project-pitch.dto";
import { ProjectPitchParamDto } from "./dto/project-pitch-param.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";

@Controller("entities/v3/projectPitches")
export class ProjectPitchesController {
  constructor(
    private readonly projectPitchService: ProjectPitchService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "projectPitchIndex",
    summary: "Get projects pitches."
  })
  @JsonApiResponse([{ data: ProjectPitchDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async projectPitchIndex(@Query() params: ProjectPitchQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.projectPitchService.getProjectPitches(params);
    const document = buildJsonApi(ProjectPitchDto, { pagination: "number" });
    const indexIds: string[] = [];
    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const pitch of data) {
        indexIds.push(pitch.uuid);
        const pitchDto = new ProjectPitchDto(pitch);
        document.addData(pitchDto.uuid, pitchDto);
      }
    }
    document.addIndexData({
      resource: "projectPitches",
      requestPath: `/entities/v3/projectPitches${getStableRequestQuery(params)}`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
    return document.serialize();
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "projectPitchGet",
    summary: "Get an project pitch by uuid."
  })
  @JsonApiResponse(ProjectPitchDto, { status: HttpStatus.OK })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Project pitch not found" })
  async projectPitchGet(@Param() { uuid }: ProjectPitchParamDto) {
    const result = await this.projectPitchService.getProjectPitch(uuid);
    await this.policyService.authorize("read", result);
    return buildJsonApi(ProjectPitchDto).addData(uuid, new ProjectPitchDto(result)).document.serialize();
  }
}
