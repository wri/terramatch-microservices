import { Get, Query, Controller } from "@nestjs/common";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { CacheService } from "./dto/cache.service";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { DashboardFrameworksService, DashboardFrameworkItem } from "./dashboard-frameworks.service";

@Controller("dashboard/v3")
export class DashboardFrameworksController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly dashboardFrameworksService: DashboardFrameworksService
  ) {}

  @Get("frameworks")
  @NoBearerAuth
  @ApiOperation({
    operationId: "getDashboardFrameworks",
    summary: "Get list of frameworks for dashboard dropdowns (filtered by current dashboard query)"
  })
  @ApiOkResponse({
    description: "Array of frameworks with at least one project matching the filters",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          framework_slug: { type: "string", example: "terrafund" },
          name: { type: "string", example: "TerraFund" }
        },
        required: ["framework_slug", "name"]
      }
    }
  })
  async getFrameworks(@Query() query: DashboardQueryDto): Promise<DashboardFrameworkItem[]> {
    const cacheKey = `dashboard:frameworks|${this.cacheService.getCacheKeyFromQuery(query)}`;
    return await this.cacheService.get(cacheKey, () => this.dashboardFrameworksService.getFrameworks(query));
  }
}
