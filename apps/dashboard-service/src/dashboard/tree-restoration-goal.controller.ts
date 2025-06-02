import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { TreeRestorationGoalDto } from "./dto/tree-restoration-goal.dto";
import { TreeRestorationGoalService } from "./dto/tree-restoration-goal.service";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";

@Controller("dashboard/v3/treeRestorationGoal")
export class TreeRestorationGoalController {
  constructor(
    private readonly treeRestorationGoalService: TreeRestorationGoalService,
    private readonly cacheService: CacheService
  ) {}

  @Get()
  @JsonApiResponse([TreeRestorationGoalDto])
  @ApiOperation({ operationId: "getTreeRestorationGoal", summary: "Get tree restoration goal statistics" })
  async getTreeRestorationGoal(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:tree-restoration-goal|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const timestampKey = `${cacheKey}:timestamp`;
    const lastUpdatedAt = await this.cacheService.get(timestampKey);
    const cachedData = await this.cacheService.get(cacheKey);

    if (cachedData == null) {
      const result = await this.treeRestorationGoalService.getTreeRestorationGoal(query);
      const timestamp = new Date().toISOString();
      await this.cacheService.set(cacheKey, JSON.stringify(result));
      await this.cacheService.set(timestampKey, timestamp);
      return result;
    }

    const document = buildJsonApi(TreeRestorationGoalDto);
    const stableQuery = getStableRequestQuery(query);

    document.addData(
      stableQuery,
      new TreeRestorationGoalDto({
        ...cachedData,
        lastUpdatedAt
      })
    );

    return document.serialize();
  }
}
