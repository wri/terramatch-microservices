import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { TotalSectionHeaderDto } from "./dto/total-serction-header.dto";
import { DelayedJobDto } from "./delayed-job.dto";

@Controller("dashboard/v3/totalSectionHeaders")
export class TotalSectionHeaderController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  @JsonApiResponse(TotalSectionHeaderDto)
  @JsonApiResponse(DelayedJobDto)
  @ApiOperation({ summary: "Get total section header" })
  async getTotalSectionHeader(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:total-section-header|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const cachedData = await this.cacheService.get(cacheKey);
    const parseCachedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
    if (cachedData == null) {
      const delayedJob = await DelayedJob.create({});
      await this.cacheService.getTotalSectionHeader(cacheKey, query, delayedJob.id);
      const delayedJobDto = new DelayedJobDto(delayedJob);
      return delayedJobDto;
    }

    const {
      totalNonProfitCount,
      totalEnterpriseCount,
      totalEntries,
      totalHectaresRestored,
      totalHectaresRestoredGoal,
      totalTreesRestored,
      totalTreesRestoredGoal
    } = parseCachedData;

    return buildJsonApi(TotalSectionHeaderDto)
      .addData(
        "total-section-header",
        new TotalSectionHeaderDto({
          totalNonProfitCount,
          totalEnterpriseCount,
          totalEntries,
          totalHectaresRestored,
          totalHectaresRestoredGoal,
          totalTreesRestored,
          totalTreesRestoredGoal
        })
      )
      .document.serialize();
  }
}
