import { Controller, Get, Param, Query, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { JsonApiResponse, ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardEntityDto } from "./dto/dashboard-entity.dto";
import { DashboardEntity } from "@terramatch-microservices/database/constants";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { CurrentUser } from "./decorators/current-user.decorator";
import { User } from "@terramatch-microservices/database/entities";
import { DashboardAuthService } from "./services/dashboard-auth.service";
import { CacheService } from "./dto/cache.service";

@Controller("dashboard/v3")
export class DashboardEntitiesController {
  constructor(
    private readonly dashboardEntitiesService: DashboardEntitiesService,
    private readonly dashboardAuthService: DashboardAuthService,
    private readonly cacheService: CacheService
  ) {}

  @Get(":entity")
  @NoBearerAuth
  @ApiParam({ name: "entity", enum: ["dashboardProjects"], description: "Dashboard entity type" })
  @JsonApiResponse({ data: DashboardEntityDto, pagination: "number" })
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
  @JsonApiResponse([DashboardEntityDto])
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  @ApiOperation({
    operationId: "dashboardEntityGet",
    summary: "Get a single dashboard entity. Returns full data if authorized, light data otherwise."
  })
  async findOne(
    @Param("entity") entity: DashboardEntity,
    @Param("uuid") uuid: string,
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: User | null
  ) {
    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const model = await processor.findOne(uuid);

    if (model === null) {
      throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
    }

    const authResult = await this.dashboardAuthService.checkUserProjectAccess(uuid, user);

    if (authResult.allowed) {
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
    } else {
      const { id, dto } = await processor.getLightDto(model);
      const document = buildJsonApi(processor.LIGHT_DTO);
      document.addData(id, dto);
      return document.serialize();
    }
  }
}
