import { BadRequestException, Controller, Get, Query, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import type { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { ProjectFilterOptionsQueryDto } from "./dto/project-filter-options-query.dto";
import { ProjectFilterOptionsDto } from "./dto/project-filter-options.dto";
import { ProjectMapIndexQueryDto } from "./dto/project-map-index-query.dto";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";
import { ProjectFilterOptionsService } from "./project-filter-options.service";
import { ProjectMapIndexService } from "./project-map-index.service";

@Controller("research/v3/projects")
export class ProjectsController {
  constructor(
    private readonly projectMapIndexService: ProjectMapIndexService,
    private readonly projectFilterOptionsService: ProjectFilterOptionsService,
    private readonly policyService: PolicyService
  ) {}

  @Get("mapIndex")
  @ApiOperation({
    operationId: "projectsMapIndex",
    summary: "Get a sparse list of projects for the cohort map and the project context filter",
    description: `Returns one resource whose attributes hold every project as
    \`{ uuid, name, lat, long, frameworkKey, level0Project, cohort, polygonCount, sumNumTrees, sumCalcArea,
    latestQaCycle, latestQaStatus }\`, plus a \`total\`. There is no pagination: the payload stays small because each
    row carries only the fields needed to place a project marker, fill its tooltip and build the framework / country /
    cohort facets.

    frameworkKey[], country[], organisationUuid[] and plantingStatus are optional and combine. Test projects
    are excluded. Projects without polygons are included with a null lat / long, so they can still be selected.`
  })
  @JsonApiResponse(ProjectMapIndexDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "A filter value is invalid." })
  async mapIndex(@Query() query: ProjectMapIndexQueryDto) {
    await this.policyService.authorize("read", SitePolygon);

    const frameworkScope = this.policyService.permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    const mapIndex = await this.projectMapIndexService.getMapIndex(
      query,
      frameworkScope.length > 0 ? frameworkScope : null
    );

    return buildJsonApi(ProjectMapIndexDto).addData(getStableRequestQuery(query), mapIndex);
  }

  @Get("filterOptions")
  @ApiOperation({
    operationId: "projectsFilterOptions",
    summary: "Get the organisation, framework, country and project options for the polygon review project selector",
    description: `Returns one resource with \`organisations\`, \`frameworkKeys\`, \`countries\` and \`projects\` option
    lists. Each list counts accessible projects and is narrowed by every selected filter except its own, so selecting
    a framework, country, organisation or project narrows the other lists. Organisations appear only when they own at
    least one matching accessible project. \`organisationSearch\` and \`projectSearch\` are case-insensitive partial
    matches that narrow only their own list.`
  })
  @JsonApiResponse(ProjectFilterOptionsDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "A filter value is invalid." })
  async filterOptions(@Query() query: ProjectFilterOptionsQueryDto) {
    await this.policyService.authorize("read", SitePolygon);

    const frameworkScope = this.policyService.permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    const options = await this.projectFilterOptionsService.getFilterOptions(
      query,
      frameworkScope.length > 0 ? frameworkScope : null
    );

    return buildJsonApi(ProjectFilterOptionsDto).addData(getStableRequestQuery(query), options);
  }
}
