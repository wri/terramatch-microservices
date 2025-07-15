import { Get, Query, Controller, Param, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { DashboardEntityWithUuidDto, DashboardEntityParamsDto } from "./dto/dashboard-entity.dto";
import { DASHBOARD_ENTITIES } from "@terramatch-microservices/database/constants";
import { ProjectAuthService } from "./services/project-auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { User } from "@terramatch-microservices/database/entities";

@Controller("dashboard/v3")
export class DashboardEntitiesController {
  constructor(
    private readonly dashboardEntitiesService: DashboardEntitiesService,
    private readonly projectAuthService: ProjectAuthService
  ) {}

  @Get(":entity")
  @NoBearerAuth
  @ApiParam({ name: "entity", enum: DASHBOARD_ENTITIES, description: "Dashboard entity type" })
  @JsonApiResponse([DashboardProjectsLightDto, DashboardProjectsFullDto])
  @ApiOperation({
    operationId: "dashboardEntityIndex",
    summary:
      "Get a list of dashboard entities. Returns full data for specific project if projectUuid is provided and user is authenticated."
  })
  async dashboardEntityIndex(
    @Param() { entity }: DashboardEntityParamsDto,
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: User | null
  ) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const cacheService = this.dashboardEntitiesService.getCacheService();

    if (query.projectUuid !== undefined && query.projectUuid !== null && query.projectUuid.trim() !== "") {
      const authResult = await this.projectAuthService.checkUserProjectAccess(query.projectUuid, user);

      const models = await processor.findMany(query);

      if (models.length === 0) {
        throw new NotFoundException(`${entity} with UUID ${query.projectUuid} not found`);
      }

      const project = models[0];

      if (authResult.allowed === true) {
        const { id, dto } = await processor.getFullDto(project);
        const document = buildJsonApi(processor.FULL_DTO);
        document.addData(id, dto);
        return document.serialize();
      } else {
        const { id, dto } = await processor.getLightDto(project);
        const document = buildJsonApi(processor.LIGHT_DTO);
        document.addData(id, dto);
        return document.serialize();
      }
    }

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
  async dashboardEntityGet(@Param() { entity, uuid }: DashboardEntityWithUuidDto) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);

    const model = await processor.findOne(uuid);
    if (model == null) {
      throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
    }

    // TODO: Add policy checks here later

    const { id, dto } = await processor.getFullDto(model);
    const document = buildJsonApi(processor.FULL_DTO);
    document.addData(id, dto);

    return document.serialize();
  }
}
