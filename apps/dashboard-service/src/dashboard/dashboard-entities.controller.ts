import { Controller, Get, Param, Query, NotFoundException, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { JsonApiResponse, ExceptionResponse } from "@terramatch-microservices/common/decorators";
import {
  buildJsonApi,
  getStableRequestQuery,
  getDtoType
} from "@terramatch-microservices/common/util/json-api-builder";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardEntity } from "@terramatch-microservices/database/constants";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "./dto/cache.service";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { UserContextInterceptor } from "./interceptors/user-context.interceptor";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { Project } from "@terramatch-microservices/database/entities";
import { DASHBOARD_ENTITIES, DASHBOARD_PROJECTS } from "./constants/dashboard-entities.constants";

@Controller("dashboard/v3")
@UseInterceptors(UserContextInterceptor)
export class DashboardEntitiesController {
  constructor(
    private readonly dashboardEntitiesService: DashboardEntitiesService,
    private readonly policyService: PolicyService,
    private readonly cacheService: CacheService
  ) {}

  @Get(":entity")
  @NoBearerAuth
  @ApiParam({
    name: "entity",
    enum: DASHBOARD_ENTITIES,
    description: "Dashboard entity type"
  })
  @JsonApiResponse({ data: DashboardProjectsLightDto, pagination: "number" })
  @ApiOperation({
    operationId: "dashboardEntityIndex",
    summary: "Get a list of dashboard entities. Returns light data for all users."
  })
  async findAll(@Param("entity") entity: DashboardEntity, @Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:${entity}|${this.cacheService.getCacheKeyFromQuery(query)}`;

    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const DtoClass = processor.LIGHT_DTO;

    const { data = [], total = 0 } = await this.cacheService.get(cacheKey, async () => {
      const models = await processor.findMany(query);
      let rawData;
      if (entity === DASHBOARD_PROJECTS) {
        const queryBuilder = new DashboardProjectsQueryBuilder(Project, [
          {
            association: "organisation",
            attributes: ["uuid", "name", "type"]
          }
        ]).queryFilters(query);
        const total = await queryBuilder.count();
        rawData = await Promise.all(
          models.map(async model => {
            const dtoResult = await processor.getLightDto(model);
            return {
              id: dtoResult.id,
              model: model,
              computedData: {
                totalSites: (dtoResult.dto as DashboardProjectsLightDto).totalSites,
                totalHectaresRestoredSum: (dtoResult.dto as DashboardProjectsLightDto).totalHectaresRestoredSum,
                treesPlantedCount: (dtoResult.dto as DashboardProjectsLightDto).treesPlantedCount,
                totalJobsCreated: (dtoResult.dto as DashboardProjectsLightDto).totalJobsCreated
              }
            };
          })
        );
        return { data: rawData, total };
      } else {
        rawData = await Promise.all(
          models.map(async model => {
            const dtoResult = await processor.getLightDto(model);
            return {
              id: dtoResult.id,
              model: model,
              computedData: undefined
            };
          })
        );
        return { data: rawData, total: rawData.length };
      }
    });

    const document = buildJsonApi(DtoClass, { pagination: "number" });
    const indexIds: string[] = [];

    for (const { id, model, computedData } of data) {
      const dto =
        typeof computedData !== "undefined" && computedData !== null
          ? new DtoClass(model, computedData)
          : new DtoClass(model);
      document.addData(id, dto);
      indexIds.push(id);
    }

    document.addIndexData({
      resource: getDtoType(DtoClass),
      requestPath: `/dashboard/v3/${entity}${getStableRequestQuery(query)}`,
      ids: indexIds,
      total,
      pageNumber: 1
    });

    return document.serialize();
  }

  @Get(":entity/:uuid")
  @NoBearerAuth
  @ApiParam({
    name: "entity",
    enum: DASHBOARD_ENTITIES,
    description: "Dashboard entity type"
  })
  @ApiParam({ name: "uuid", description: "Entity UUID" })
  @JsonApiResponse([DashboardProjectsLightDto, DashboardProjectsFullDto])
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  @ApiOperation({
    operationId: "dashboardEntityGet",
    summary: "Get a single dashboard entity. Returns full data if authorized, light data otherwise."
  })
  async findOne(@Param("entity") entity: DashboardEntity, @Param("uuid") uuid: string) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const model = await processor.findOne(uuid);

    if (model === null) {
      throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
    }

    const hasAccess = await this.policyService.hasAccess("read", model);

    if (hasAccess) {
      const { id, dto } = await processor.getFullDto(model);
      const document = buildJsonApi(processor.FULL_DTO);
      document.addData(id, dto);
      return document.serialize();
    } else {
      const { id, dto } = await processor.getLightDto(model);
      const document = buildJsonApi(processor.LIGHT_DTO);
      document.addData(id, dto);
      return document.serialize();
    }
  }
}
