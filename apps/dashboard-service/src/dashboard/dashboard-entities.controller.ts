import { Get, Query, Controller, Param, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardEntitiesService, DASHBOARD_ENTITIES } from "./dashboard-entities.service";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { DashboardEntityDto, DashboardEntityParamsDto } from "./dto/dashboard-entity.dto";

@Controller("dashboard/v3")
export class DashboardEntitiesController {
  constructor(private readonly dashboardEntitiesService: DashboardEntitiesService) {}

  @Get(":entity")
  @NoBearerAuth
  @ApiParam({ name: "entity", enum: DASHBOARD_ENTITIES, description: "Dashboard entity type" })
  @JsonApiResponse([DashboardProjectsLightDto])
  @ApiOperation({
    operationId: "dashboardEntityIndex",
    summary: "Get a list of dashboard entities with light data"
  })
  async dashboardEntityIndex(@Param() { entity }: DashboardEntityParamsDto, @Query() query: DashboardQueryDto) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const cacheService = this.dashboardEntitiesService.getCacheService();

    const cacheKey = `dashboard:${entity}|${cacheService.getCacheKeyFromQuery(query)}`;

    const models = await cacheService.get(cacheKey, () => processor.findMany(query));

    const dtoResults = await processor.getLightDtos(models);

    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });
    const indexIds: string[] = [];
    dtoResults.forEach(({ id, dto }) => {
      indexIds.push(id);
      document.addData(id, dto);
    });

    document.addIndexData({
      resource: entity,
      requestPath: `/dashboard/v3/${entity}${getStableRequestQuery(query)}`,
      ids: indexIds,
      total: models.length,
      pageNumber: 1
    });

    return document.serialize();
  }

  @Get(":entity/:uuid")
  @ApiParam({ name: "entity", enum: DASHBOARD_ENTITIES, description: "Dashboard entity type" })
  @ApiParam({ name: "uuid", description: "Entity UUID" })
  @JsonApiResponse([DashboardProjectsFullDto])
  @ApiOperation({
    operationId: "dashboardEntityGet",
    summary: "Get a single dashboard entity with full data"
  })
  async dashboardEntityGet(@Param() { entity, uuid }: DashboardEntityDto) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);

    const model = await processor.findOne(uuid);
    if (model == null) {
      throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
    }

    // TODO: Add policy checks here later
    // await this.policyService.authorize("read", model);

    const { id, dto } = await processor.getFullDto(model);
    const document = buildJsonApi(processor.FULL_DTO);
    document.addData(id, dto);

    return document.serialize();
  }
}
