import { Controller, Get, Param, Query, NotFoundException, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { JsonApiResponse, ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardEntity } from "@terramatch-microservices/database/constants";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "./dto/cache.service";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { UserContextInterceptor } from "./interceptors/user-context.interceptor";

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
  @ApiParam({ name: "entity", enum: ["dashboardProjects"], description: "Dashboard entity type" })
  @JsonApiResponse({ data: DashboardProjectsLightDto, pagination: "number" })
  @ApiOperation({
    operationId: "dashboardEntityIndex",
    summary: "Get a list of dashboard entities. Returns light data for all users."
  })
  async findAll(@Param("entity") entity: DashboardEntity, @Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:${entity}|${this.cacheService.getCacheKeyFromQuery(query)}`;

    const data = await this.cacheService.get(cacheKey, async () => {
      const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
      const models = await processor.findMany(query);
      const dtoResults = await processor.getLightDtos(models);
      return dtoResults;
    });

    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });

    data.forEach(({ id, dto }) => {
      document.addData(id, dto);
    });

    return document.serialize();
  }

  @Get(":entity/:uuid")
  @NoBearerAuth
  @ApiParam({ name: "entity", enum: ["dashboardProjects"], description: "Dashboard entity type" })
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
