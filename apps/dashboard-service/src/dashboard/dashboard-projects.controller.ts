import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { DashboardProjectsLightDto } from "./dto/dashboard-projects.dto";
import { DashboardProjectsService } from "./dashboard-projects.service";

@Controller("dashboard/v3/dashboardProjects")
export class DashboardProjectsController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly dashboardProjectsService: DashboardProjectsService
  ) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse({ data: DashboardProjectsLightDto, pagination: "number" })
  @ApiOperation({ operationId: "getDashboardProjects", summary: "Get dashboard projects" })
  async getDashboardProjects(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:projects|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const result = await this.cacheService.get(cacheKey, () =>
      this.dashboardProjectsService.getDashboardProjects(query)
    );

    const document = buildJsonApi(DashboardProjectsLightDto, { pagination: "number" });

    result.data.forEach((project: DashboardProjectsLightDto) => {
      document.addData(project.uuid, project);
    });

    document.addIndexData({
      resource: "dashboardProjects",
      requestPath: `/dashboard/v3/dashboardProjects${getStableRequestQuery(query)}`,
      ids: result.data.map(project => project.uuid),
      total: result.paginationTotal,
      pageNumber: result.pageNumber
    });

    return document.serialize();
  }
}
