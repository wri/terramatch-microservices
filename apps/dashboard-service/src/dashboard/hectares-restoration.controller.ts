import { Get, Query, Controller, BadRequestException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
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
    if (query.projectUuid == null) {
      throw new BadRequestException("Invalid projectUuid");
    }
    const cacheKey = `dashboard:hectares-restoration|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const cachedData = await this.cacheService.get(cacheKey, () => this.hectaresRestorationService.getResults(query));
    const document = buildJsonApi(HectareRestorationDto);
    const stableQuery = getStableRequestQuery(query);
    document.addData(stableQuery, new HectareRestorationDto(cachedData));
    return document.serialize();
  }
}
