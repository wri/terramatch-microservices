import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { DelayedJobDto } from "./dto/delayed-job.dto";
import { CacheService } from "./dto/cache.service";
import { DelayedJob } from "@terramatch-microservices/database/entities";

@Controller("dashboard/v3/totalSectionHeaders")
export class TotalSectionHeaderController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  @JsonApiResponse(DelayedJobDto)
  @ApiOperation({ summary: "Get total section header" })
  async getTotalSectionHeader(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:total-section-header|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const cachedData = await this.cacheService.get(cacheKey);
    if (cachedData == null) {
      const delayedJob = await DelayedJob.create({});
      await this.cacheService.getTotalSectionHeader(cacheKey, query, delayedJob.id);
      const delayedJobDto = new DelayedJobDto(delayedJob);
      return delayedJobDto;
    }
    return JSON.parse(cachedData);
  }
}
