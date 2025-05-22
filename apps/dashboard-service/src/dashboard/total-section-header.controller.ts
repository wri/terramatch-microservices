import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildFixedOrderedQueryString, buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { TotalSectionHeaderDto } from "./dto/total-serction-header.dto";
import { DelayedJobDto } from "./delayed-job.dto";
import { DelayedJob } from "@terramatch-microservices/database/entities";

@Controller("dashboard/v3/totalSectionHeaders")
export class TotalSectionHeaderController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  @JsonApiResponse([TotalSectionHeaderDto, DelayedJobDto])
  @ApiOperation({ summary: "Get total section header" })
  async getTotalSectionHeader(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:total-section-header|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const lastUpdatedAt = await this.cacheService.getTimestampForTotalSectionHeader(
      this.cacheService.getCacheKeyFromQuery(query)
    );
    const cachedData = await this.cacheService.get(cacheKey);
    const parseCachedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
    if (cachedData == null) {
      const delayedJob = await DelayedJob.create();
      await this.cacheService.getTotalSectionHeader(cacheKey, query, delayedJob.id);
      const delayedJobDto = new DelayedJobDto(delayedJob);

      return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, delayedJobDto).document.serialize();
    }

    const {
      totalNonProfitCount,
      totalEnterpriseCount,
      totalEntries,
      totalHectaresRestored,
      totalHectaresRestoredGoal,
      totalTreesRestored,
      totalTreesRestoredGoal,
      uuids
    } = parseCachedData;

    const keyParams = ["country", "programmes", "cohort", "landscapes", "organisationType", "projectUuid"];
    const document = buildJsonApi(TotalSectionHeaderDto);
    const stableQuery = buildFixedOrderedQueryString(query, keyParams);

    document.addData(
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

    document.addIndexData({
      resource: "totalSectionHeaders",
      requestPath: `/dashboard/v3/totalSectionHeaders${stableQuery}`,
      ids: uuids
    });

    return document.serialize();
  }
}
