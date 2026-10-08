import { BadRequestException, Controller, Get, Query, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { ProjectMapIndexQueryDto } from "./dto/project-map-index-query.dto";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";
import { ProjectMapIndexService } from "./project-map-index.service";

@Controller("research/v3/projects")
export class ProjectsController {
  constructor(
    private readonly projectMapIndexService: ProjectMapIndexService,
    private readonly policyService: PolicyService
  ) {}

  @Get("mapIndex")
  @ApiOperation({
    operationId: "projectsMapIndex",
    summary: "Get a sparse list of project centroids for the cohort map",
    description: `Returns one resource whose attributes hold every project centroid as
    \`{ uuid, name, lat, long }\`, plus a \`total\`. There is no pagination: the payload stays small because
    each row carries only the fields needed to place a project marker.

    frameworkKey[], country[], organisationUuid[] and plantingStatus are optional and combine. Test projects
    and projects without a centroid are excluded.`
  })
  @JsonApiResponse(ProjectMapIndexDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "A filter value is invalid." })
  async mapIndex(@Query() query: ProjectMapIndexQueryDto) {
    await this.policyService.authorize("read", SitePolygon);

    const mapIndex = await this.projectMapIndexService.getMapIndex(query);

    return buildJsonApi(ProjectMapIndexDto).addData(getStableRequestQuery(query), mapIndex);
  }
}
