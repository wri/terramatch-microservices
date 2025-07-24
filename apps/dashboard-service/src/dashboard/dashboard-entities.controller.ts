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
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "./dto/cache.service";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { DashboardImpactStoryLightDto } from "./dto/dashboard-impact-story.dto";
import { UserContextInterceptor } from "./interceptors/user-context.interceptor";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { Project } from "@terramatch-microservices/database/entities";
import {
  DASHBOARD_ENTITIES,
  DASHBOARD_PROJECTS,
  DASHBOARD_IMPACT_STORIES,
  DashboardEntity
} from "./constants/dashboard-entities.constants";
import { DashboardImpactStoryService } from "./dashboard-impact-story.service";
import { Media } from "@terramatch-microservices/database/entities";
import { ImpactStory } from "@terramatch-microservices/database/entities";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

@Controller("dashboard/v3")
@UseInterceptors(UserContextInterceptor)
export class DashboardEntitiesController {
  constructor(
    private readonly dashboardEntitiesService: DashboardEntitiesService,
    private readonly policyService: PolicyService,
    private readonly cacheService: CacheService,
    private readonly dashboardImpactStoryService: DashboardImpactStoryService,
    private readonly mediaService: MediaService
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

    if (entity === DASHBOARD_PROJECTS) {
      const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
      const DtoClass = processor.LIGHT_DTO;
      const { data = [], total = 0 } = await this.cacheService.get(cacheKey, async () => {
        const models = await processor.findMany(query);
        const queryBuilder = new DashboardProjectsQueryBuilder(Project, [
          {
            association: "organisation",
            attributes: ["uuid", "name", "type"]
          }
        ]).queryFilters(query);
        const total = await queryBuilder.count();
        const rawData = await Promise.all(
          models.map(async model => {
            const dtoResult = await processor.getLightDto(model);
            return {
              id: dtoResult.id,
              model: model,
              computedData: {
                organisationName: (dtoResult.dto as DashboardProjectsLightDto).organisationName,
                organisationType: (dtoResult.dto as DashboardProjectsLightDto).organisationType,
                totalSites: (dtoResult.dto as DashboardProjectsLightDto).totalSites,
                totalHectaresRestoredSum: (dtoResult.dto as DashboardProjectsLightDto).totalHectaresRestoredSum,
                treesPlantedCount: (dtoResult.dto as DashboardProjectsLightDto).treesPlantedCount,
                totalJobsCreated: (dtoResult.dto as DashboardProjectsLightDto).totalJobsCreated,
                hasAccess: (dtoResult.dto as DashboardProjectsLightDto).hasAccess
              }
            };
          })
        );
        return { data: rawData, total };
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

    if (entity === DASHBOARD_IMPACT_STORIES) {
      const { data = [], total = 0 } = await this.cacheService.get(cacheKey, async () => {
        const impactStories = await this.dashboardImpactStoryService.getDashboardImpactStories({
          country: query.country,
          organisationType: query.organisationType
        });
        return { data: impactStories, total: impactStories.length };
      });
      const document = buildJsonApi(DashboardImpactStoryLightDto, { pagination: "number" });
      const indexIds: string[] = [];
      for (const impactStory of data) {
        const dto = new DashboardImpactStoryLightDto(impactStory);
        const org = impactStory.organisation;
        dto.organization =
          org != null
            ? {
                name: org.name ?? "",
                countries: Array.isArray(org.countries)
                  ? org.countries
                      .filter((c: string) => c != null && c !== "")
                      .map((c: string) => ({ label: c, icon: c !== "" ? `/flags/${c.toLowerCase()}.svg` : null }))
                  : [],
                facebook_url: org.facebookUrl != null && org.facebookUrl !== "" ? org.facebookUrl : null,
                instagram_url: org.instagramUrl != null && org.instagramUrl !== "" ? org.instagramUrl : null,
                linkedin_url: org.linkedinUrl != null && org.linkedinUrl !== "" ? org.linkedinUrl : null,
                twitter_url: org.twitterUrl != null && org.twitterUrl !== "" ? org.twitterUrl : null
              }
            : null;

        const mediaCollection = await Media.findAll({
          where: {
            modelType: ImpactStory.LARAVEL_TYPE,
            modelId: impactStory.id,
            collectionName: "thumbnail"
          }
        });
        dto.thumbnail = mediaCollection.length > 0 ? this.mediaService.getUrl(mediaCollection[0]) : "";

        dto.category = Array.isArray(impactStory.category)
          ? impactStory.category.filter((cat: string) => cat != null && cat !== "")
          : impactStory.category != null && impactStory.category !== ""
          ? [impactStory.category]
          : [];

        document.addData(dto.uuid, dto);
        indexIds.push(dto.uuid);
      }
      document.addIndexData({
        resource: getDtoType(DashboardImpactStoryLightDto),
        requestPath: `/dashboard/v3/${entity}${getStableRequestQuery(query)}`,
        ids: indexIds,
        total,
        pageNumber: 1
      });
      return document.serialize();
    }

    const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
    const DtoClass = processor.LIGHT_DTO;
    const { data = [], total = 0 } = await this.cacheService.get(cacheKey, async () => {
      const models = await processor.findMany(query);
      const rawData = await Promise.all(
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
    });
    const document = buildJsonApi(DtoClass, { pagination: "number" });
    const indexIds: string[] = [];
    for (const { id, model } of data) {
      const dto = new DtoClass(model);
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
    if (entity === DASHBOARD_PROJECTS) {
      const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
      const model = await processor.findOne(uuid);
      if (model === null) {
        throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
      }
      const { id, dto } = await processor.getFullDto(model);
      const document = buildJsonApi(processor.FULL_DTO);
      document.addData(id, dto);
      return document.serialize();
    }

    if (entity === DASHBOARD_IMPACT_STORIES) {
      const impactStory = await this.dashboardImpactStoryService.getDashboardImpactStoryById(uuid);
      if (impactStory === null) {
        throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
      }

      const dto = new DashboardImpactStoryLightDto(impactStory);

      const org = impactStory.organisation;
      dto.organization =
        org != null
          ? {
              name: org.name ?? "",
              countries: Array.isArray(org.countries)
                ? org.countries
                    .filter((c: string) => c != null && c !== "")
                    .map((c: string) => ({ label: c, icon: c !== "" ? `/flags/${c.toLowerCase()}.svg` : null }))
                : [],
              facebook_url: org.facebookUrl != null && org.facebookUrl !== "" ? org.facebookUrl : null,
              instagram_url: org.instagramUrl != null && org.instagramUrl !== "" ? org.instagramUrl : null,
              linkedin_url: org.linkedinUrl != null && org.linkedinUrl !== "" ? org.linkedinUrl : null,
              twitter_url: org.twitterUrl != null && org.twitterUrl !== "" ? org.twitterUrl : null
            }
          : null;

      // Set thumbnail
      const mediaCollection = await Media.findAll({
        where: {
          modelType: ImpactStory.LARAVEL_TYPE,
          modelId: impactStory.id,
          collectionName: "thumbnail"
        }
      });
      dto.thumbnail = mediaCollection.length > 0 ? this.mediaService.getUrl(mediaCollection[0]) : "";

      // Set category
      dto.category = Array.isArray(impactStory.category)
        ? impactStory.category.filter((cat: string) => cat != null && cat !== "")
        : impactStory.category != null && impactStory.category !== ""
        ? [impactStory.category]
        : [];

      const document = buildJsonApi(DashboardImpactStoryLightDto);
      document.addData(uuid, dto);
      return document.serialize();
    }

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
