import { Controller, Get, NotFoundException, Param, Query, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util/json-api-builder";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "./dto/cache.service";
import { DashboardProjectsFullDto, DashboardProjectsLightDto } from "./dto/dashboard-projects.dto";
import { DashboardImpactStoryFullDto, DashboardImpactStoryLightDto } from "./dto/dashboard-impact-story.dto";
import { DashboardSitePolygonsLightDto } from "./dto/dashboard-sitepolygons.dto";
import { UserContextInterceptor } from "./interceptors/user-context.interceptor";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { ImpactStory, Media, Project } from "@terramatch-microservices/database/entities";
import {
  DASHBOARD_ENTITIES,
  DASHBOARD_IMPACT_STORIES,
  DASHBOARD_PROJECTS,
  DASHBOARD_SITEPOLYGONS,
  DashboardEntity
} from "./constants/dashboard-entities.constants";
import { DashboardImpactStoryService } from "./dashboard-impact-story.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createOrganisationUrls } from "./utils/organisation.utils";

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
  @JsonApiResponse([
    { data: DashboardProjectsLightDto, pagination: "number" },
    { data: DashboardImpactStoryLightDto, pagination: "number" },
    { data: DashboardSitePolygonsLightDto, pagination: "number" }
  ])
  @ApiOperation({
    operationId: "dashboardEntityIndex",
    summary: "Get a list of dashboard entities. Returns light data for all users."
  })
  async findAll(@Param("entity") entity: DashboardEntity, @Query() query: DashboardQueryDto) {
    const cacheKey = `dashboard:${entity}|${this.cacheService.getCacheKeyFromQuery(query)}`;

    if (entity === DASHBOARD_IMPACT_STORIES) {
      const { data = [], total = 0 } = await this.cacheService.get(cacheKey, async () => {
        const impactStories = await this.dashboardImpactStoryService.getDashboardImpactStories({
          country: query.country,
          organisationType: query.organisationType
        });
        const plainData = impactStories.map(story =>
          typeof story.get === "function" ? story.get({ plain: true }) : story
        );
        return { data: plainData, total: plainData.length };
      });
      const document = buildJsonApi(DashboardImpactStoryLightDto, { pagination: "number" });
      for (const impactStory of data) {
        const org = impactStory.organisation;
        const organisation =
          org != null
            ? createOrganisationUrls({
                ...org,
                facebookUrl: org.facebookUrl ?? undefined,
                instagramUrl: org.instagramUrl ?? undefined,
                linkedinUrl: org.linkedinUrl ?? undefined,
                twitterUrl: org.twitterUrl ?? undefined
              })
            : null;

        const mediaCollection = await Media.findAll({
          where: {
            modelType: ImpactStory.LARAVEL_TYPE,
            modelId: impactStory.id,
            collectionName: "thumbnail"
          }
        });
        const thumbnail = mediaCollection.length > 0 ? this.mediaService.getUrl(mediaCollection[0]) : "";

        const category = Array.isArray(impactStory.category)
          ? impactStory.category.filter((cat: string) => cat != null && cat !== "")
          : impactStory.category != null && impactStory.category !== ""
          ? [impactStory.category]
          : [];

        const dto = new DashboardImpactStoryLightDto(impactStory, {
          organisation,
          thumbnail: thumbnail != null ? thumbnail : "",
          category
        });

        document.addData(dto.uuid, dto);
      }
      return document
        .addIndex({
          requestPath: `/dashboard/v3/${entity}${getStableRequestQuery(query)}`,
          total,
          pageNumber: 1
        })
        .serialize();
    }

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
      for (const { id, model, computedData } of data) {
        const dto =
          typeof computedData !== "undefined" && computedData !== null
            ? new DtoClass(model, computedData)
            : new DtoClass(model);
        document.addData(id, dto);
      }
      return document
        .addIndex({
          requestPath: `/dashboard/v3/${entity}${getStableRequestQuery(query)}`,
          total,
          pageNumber: 1
        })
        .serialize();
    }

    if (entity === DASHBOARD_SITEPOLYGONS) {
      const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
      const DtoClass = processor.LIGHT_DTO;
      const { data = [], total = 0 } = await this.cacheService.get(cacheKey, async () => {
        const models = await processor.findMany(query);
        const rawData = await Promise.all(
          models.map(async model => {
            const dtoResult = await processor.getLightDto(model);
            return {
              id: dtoResult.id,
              model: model
            };
          })
        );
        return { data: rawData, total: rawData.length };
      });
      const document = buildJsonApi(DtoClass, { pagination: "number" });
      for (const { id, model } of data) {
        document.addData(id, new DtoClass(model));
      }
      return document
        .addIndex({
          requestPath: `/dashboard/v3/${entity}${getStableRequestQuery(query)}`,
          total,
          pageNumber: 1
        })
        .serialize();
    }

    throw new NotFoundException(`Entity type ${entity} is not supported for listing`);
  }

  @Get(":entity/:uuid")
  @NoBearerAuth
  @ApiParam({
    name: "entity",
    enum: DASHBOARD_ENTITIES,
    description: "Dashboard entity type"
  })
  @ApiParam({ name: "uuid", description: "Entity UUID" })
  @JsonApiResponse([
    { data: DashboardProjectsLightDto, pagination: "number" },
    { data: DashboardProjectsFullDto, pagination: "number" },
    { data: DashboardImpactStoryFullDto, pagination: "number" },
    { data: DashboardSitePolygonsLightDto, pagination: "number" }
  ])
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  @ApiOperation({
    operationId: "dashboardEntityGet",
    summary: "Get a single dashboard entity. Returns full data if authorized, light data otherwise."
  })
  async findOne(@Param("entity") entity: DashboardEntity, @Param("uuid") uuid: string) {
    if (entity === DASHBOARD_IMPACT_STORIES) {
      const impactStoryRaw = await this.dashboardImpactStoryService.getDashboardImpactStoryById(uuid);
      if (impactStoryRaw === null) {
        throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
      }

      const impactStory =
        typeof impactStoryRaw.get === "function" ? impactStoryRaw.get({ plain: true }) : impactStoryRaw;

      const org = impactStory.organisation;
      const organisation =
        org != null
          ? createOrganisationUrls({
              ...org,
              facebookUrl: org.facebookUrl ?? undefined,
              instagramUrl: org.instagramUrl ?? undefined,
              linkedinUrl: org.linkedinUrl ?? undefined,
              twitterUrl: org.twitterUrl ?? undefined
            })
          : null;

      const mediaCollection = await Media.findAll({
        where: {
          modelType: ImpactStory.LARAVEL_TYPE,
          modelId: impactStory.id,
          collectionName: "thumbnail"
        }
      });
      const thumbnail = mediaCollection.length > 0 ? this.mediaService.getUrl(mediaCollection[0]) : "";

      const category = Array.isArray(impactStory.category)
        ? impactStory.category.filter((cat: string) => cat != null && cat !== "")
        : impactStory.category != null && impactStory.category !== ""
        ? [impactStory.category]
        : [];

      const dto = new DashboardImpactStoryFullDto(impactStory, {
        organisation,
        thumbnail: thumbnail != null ? thumbnail : "",
        category
      });

      const document = buildJsonApi(DashboardImpactStoryFullDto);
      document.addData(uuid, dto);
      return document.serialize();
    }

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

    if (entity === DASHBOARD_SITEPOLYGONS) {
      const processor = this.dashboardEntitiesService.createDashboardProcessor(entity);
      const model = await processor.findOne(uuid);
      if (model === null) {
        throw new NotFoundException(`${entity} with UUID ${uuid} not found`);
      }
      const { id, dto } = await processor.getLightDto(model);
      const document = buildJsonApi(processor.LIGHT_DTO);
      document.addData(id, dto);
      return document.serialize();
    }

    throw new NotFoundException(`Entity type ${entity} is not supported for single entity retrieval`);
  }
}
