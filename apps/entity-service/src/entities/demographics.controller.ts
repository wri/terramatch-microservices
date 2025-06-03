import { BadRequestException, Controller, Get, HttpStatus, NotFoundException, Param, Query } from "@nestjs/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ProjectPitchDto } from "./dto/project-pitch.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { DemographicDto } from "./dto/demographic.dto";
import { DemographicQueryDto } from "./dto/demographic-query.dto";
import { DemographicService } from "./demographic.service";

@Controller("entities/v3/demographics")
export class DemographicsController {
  constructor(private readonly demographicService: DemographicService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "projectPitchIndex",
    summary: "Get projects pitches."
  })
  @JsonApiResponse([{ data: DemographicDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async demographicsIndex(@Query() params: DemographicQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.demographicService.getDemographics(params);
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
      resource: "demographics",
      requestPath: `/entities/v3/demographics${getStableRequestQuery(params)}`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
    return document.serialize();
  }
}
