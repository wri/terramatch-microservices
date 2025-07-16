import { Get, Query, Controller, Param, NotFoundException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CacheService } from "./dto/cache.service";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { DashboardProjectsLightDto } from "./dto/dashboard-projects.dto";
import { DashboardProjectsService } from "./dashboard-projects.service";
import { DashboardEntitiesService } from "./dashboard-entities.service";

@Controller("dashboard/v3/dashboardProjects")
export class DashboardProjectsController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly dashboardProjectsService: DashboardProjectsService,
    private readonly dashboardEntitiesService: DashboardEntitiesService
  ) {}

  @Get()
  @NoBearerAuth
  @JsonApiResponse(DashboardProjectsLightDto)
  @ApiOperation({ operationId: "getDashboardProjects", summary: "Get dashboard projects" })
  async getDashboardProjects(@Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:projects|${this.cacheService.getCacheKeyFromQuery(query)}`;
    const data = await this.cacheService.get(cacheKey, () => this.dashboardProjectsService.getDashboardProjects(query));

    const document = buildJsonApi(DashboardProjectsLightDto);

    data.forEach((project: DashboardProjectsLightDto) => {
      document.addData(project.uuid, project);
    });

    return document.serialize();
  }

  @Get(":uuid")
  @NoBearerAuth
  @JsonApiResponse([DashboardProjectsLightDto])
  @ApiOperation({
    operationId: "getDashboardProject",
    summary: "Get a single dashboard project with optional sideloads"
  })
  async getDashboardProject(@Param("uuid") uuid: string, @Query() query: DashboardQueryDto) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor("dashboardProjects");
    const model = await processor.findOne(uuid);

    if (model === null) {
      throw new NotFoundException(`Project with UUID ${uuid} not found`);
    }

    const { id, dto } = await processor.getFullDto(model);
    const document = buildJsonApi(processor.FULL_DTO);
    document.addData(id, dto);

    // Process sideloads if requested
    if (query.sideloads != null && query.sideloads.length > 0) {
      for (const { entity: sideloadEntity, pageSize } of query.sideloads) {
        await processor.processSideload(document, model, sideloadEntity, pageSize);
      }
    }

    return document.serialize();
  }
}
