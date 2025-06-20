import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { TotalJobsCreatedDto } from "./dto/total-jobs-created.dto";

@Controller("dashboard/v3/totalJobsCreated")
export class TotalJobsCreatedController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse([TotalJobsCreatedDto, DelayedJobDto])
  @ApiOperation({ operationId: "getTotalJobsCreated", summary: "Get total jobs created" })
  async getTotalJobsCreated(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:jobs-created|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const lastUpdatedAt = await this.cacheService.getTimestampForTotalJobCreated(
      this.cacheService.getCacheKeyFromQuery(query)
    );
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData == null) {
      const delayedJob = await DelayedJob.create();
      await this.cacheService.getTotalJobsCreated(cacheKey, query, delayedJob.id);
      const delayedJobDto = populateDto(new DelayedJobDto(), delayedJob);

      return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, delayedJobDto).document.serialize();
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

    const document = buildJsonApi(TotalJobsCreatedDto);
    const stableQuery = getStableRequestQuery(query);

    document.addData(
      stableQuery,
      new TotalJobsCreatedDto({
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

    return document.serialize();
  }
}
