import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { TotalJobsCreatedDto } from "./dto/total-jobs-created.dto";
import { TotalJobsCreatedService } from "./total-jobs-created.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

@Controller("dashboard/v3/totalJobsCreated")
export class TotalJobsCreatedController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly jobsCreatedService: TotalJobsCreatedService
  ) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse([TotalJobsCreatedDto, DelayedJobDto])
  @ApiOperation({ operationId: "getTotalJobsCreated", summary: "Get total jobs created" })
  async getTotalJobsCreated(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:jobs-created|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const data = await this.cacheService.get(cacheKey, () => this.jobsCreatedService.getTotals(query));

    const document = buildJsonApi(TotalJobsCreatedDto);
    const stableQuery = getStableRequestQuery(query);

    document.addData(stableQuery, new TotalJobsCreatedDto(data));

    return document.serialize();
  }
}
