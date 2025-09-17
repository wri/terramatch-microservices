import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { TreeRestorationGoalDto } from "./dto/tree-restoration-goal.dto";
import { TreeRestorationGoalService } from "./dto/tree-restoration-goal.service";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";

@Controller("dashboard/v3/treeRestorationGoal")
export class TreeRestorationGoalController {
  constructor(
    private readonly treeRestorationGoalService: TreeRestorationGoalService,
    private readonly cacheService: CacheService
  ) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse(TreeRestorationGoalDto)
  @ApiOperation({ operationId: "getTreeRestorationGoal", summary: "Get tree restoration goal statistics" })
  async getTreeRestorationGoal(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:tree-restoration-goal|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const timestampKey = `${cacheKey}:timestamp`;

    const lastUpdatedAt = await this.cacheService.get(timestampKey, () => Promise.resolve(new Date().toISOString()));
    const result = await this.cacheService.get(cacheKey, async () => {
      const data = await this.treeRestorationGoalService.getTreeRestorationGoal(query);
      await this.cacheService.set(timestampKey, new Date().toISOString());
      return data;
    });

    const stableQuery = getStableRequestQuery(query);
    return buildJsonApi(TreeRestorationGoalDto).addData(
      stableQuery,
      new TreeRestorationGoalDto({
        ...result,
        lastUpdatedAt
      })
    );
  }
}
