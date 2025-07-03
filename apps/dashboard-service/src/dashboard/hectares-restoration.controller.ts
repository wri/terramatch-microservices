import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { TotalSectionHeaderDto } from "./dto/total-section-header.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { HectareRestorationDto } from "./dto/hectare-restoration.dto";
import { HectaresRestorationService } from "./hectares-restoration.service";

@Controller("dashboard/v3/hectaresRestoration")
export class HectaresRestorationController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly hectaresRestorationService: HectaresRestorationService
  ) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse([HectareRestorationDto])
  @ApiOperation({ operationId: "getHectaresRestoration", summary: "Get hectares restoration" })
  async getHectaresRestoration(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:hectares-restoration|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const lastUpdatedAt = await this.cacheService.getTimestampForTotalSectionHeader(
      this.cacheService.getCacheKeyFromQuery(query)
    );
    let cachedData = await this.cacheService.get(cacheKey);
    if (cachedData == null) {
      cachedData = await this.hectaresRestorationService.getResult(query);
      await this.cacheService.set(cacheKey, JSON.stringify(cachedData));
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
