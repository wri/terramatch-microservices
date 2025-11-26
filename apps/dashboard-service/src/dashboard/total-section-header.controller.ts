import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import {
  buildJsonApi,
  buildDelayedJobResponse,
  getStableRequestQuery
} from "@terramatch-microservices/common/util/json-api-builder";
import { TotalSectionHeaderDto } from "./dto/total-section-header.dto";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";

@Controller("dashboard/v3/totalSectionHeaders")
export class TotalSectionHeaderController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse([TotalSectionHeaderDto, DelayedJobDto])
  @ApiOperation({ operationId: "getTotalSectionHeaders", summary: "Get total section header" })
  async getTotalSectionHeader(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:total-section-header|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const lastUpdatedAt = await this.cacheService.getTimestampForTotalSectionHeader(
      this.cacheService.getCacheKeyFromQuery(query)
    );
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData == null) {
      const delayedJob = await DelayedJob.create();
      await this.cacheService.getTotalSectionHeader(cacheKey, query, delayedJob.id);
      return buildDelayedJobResponse(delayedJob);
    }

    const {
      totalNonProfitCount,
      totalEnterpriseCount,
      totalEntries,
      totalHectaresRestored,
      totalHectaresRestoredGoal,
      totalTreesRestored,
      totalTreesRestoredGoal
    } = cachedData;

    const stableQuery = getStableRequestQuery(query);

    return buildJsonApi(TotalSectionHeaderDto).addData(
      stableQuery,
      new TotalSectionHeaderDto({
        totalNonProfitCount,
        totalEnterpriseCount,
        totalEntries,
        totalHectaresRestored,
        totalHectaresRestoredGoal,
        totalTreesRestored,
        totalTreesRestoredGoal,
        lastUpdatedAt
      })
    );
  }
}
