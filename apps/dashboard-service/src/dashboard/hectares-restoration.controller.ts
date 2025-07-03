import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { TotalSectionHeaderDto } from "./dto/total-section-header.dto";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HectareRestorationDto } from "./dto/hectare-restoration.dto";

@Controller("dashboard/v3/hectaresRestoration")
export class HectaresRestorationController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse([HectareRestorationDto])
  @ApiOperation({ operationId: "getTotalSectionHeaders", summary: "Get total section header" })
  async getTotalSectionHeader(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:hectares-restoration|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const lastUpdatedAt = await this.cacheService.getTimestampForTotalSectionHeader(
      this.cacheService.getCacheKeyFromQuery(query)
    );
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData == null) {
      const delayedJob = await DelayedJob.create();
      await this.cacheService.getTotalSectionHeader(cacheKey, query, delayedJob.id);
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

    const document = buildJsonApi(TotalSectionHeaderDto);
    const stableQuery = getStableRequestQuery(query);

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

    return document.serialize();
  }
}
