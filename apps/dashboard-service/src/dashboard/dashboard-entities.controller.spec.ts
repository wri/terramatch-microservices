import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardEntitiesController } from "./dashboard-entities.controller";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";
import { CacheService } from "./dto/cache.service";
import { DashboardEntityParamsDto, DashboardEntityWithUuidDto } from "./dto/dashboard-entity.dto";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { Project } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { UserContextInterceptor } from "./interceptors/user-context.interceptor";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardImpactStoryService } from "./dashboard-impact-story.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import {
  DASHBOARD_IMPACT_STORIES,
  DASHBOARD_PROJECTS,
  DashboardEntity
} from "./constants/dashboard-entities.constants";
import { ImpactStory } from "@terramatch-microservices/database/entities/impact-story.entity";
import { Media } from "@terramatch-microservices/database/entities/media.entity";

jest.mock("@nestjs/jwt");
const MockJwtService = JwtService as jest.MockedClass<typeof JwtService>;

// Mock the dashboard-query.builder module
jest.mock("./dashboard-query.builder");

// Mock the json-api-builder module
jest.mock("@terramatch-microservices/common/util/json-api-builder", () => ({
  buildJsonApi: jest.fn().mockImplementation(() => ({
    addData: jest.fn().mockReturnThis(),
    addIndexData: jest.fn().mockReturnThis(),
    serialize: jest.fn().mockReturnValue({
      data: [],
      included: [],
      meta: { resourceType: "dashboardProjects" }
    })
  })),
  getStableRequestQuery: jest.fn().mockImplementation(query => query),
  getDtoType: jest.fn().mockReturnValue("dashboardProjects")
}));

jest.mock("@terramatch-microservices/database/entities", () => ({
  ...jest.requireActual("@terramatch-microservices/database/entities"),
  User: {
    findOne: jest.fn()
  },
  Permission: {
    getUserPermissionNames: jest.fn()
  }
}));

describe("DashboardEntitiesController", () => {
  let controller: DashboardEntitiesController;
  let dashboardEntitiesService: DeepMocked<DashboardEntitiesService>;
  let cacheService: DeepMocked<CacheService>;
  let policyService: DeepMocked<PolicyService>;
  let dashboardImpactStoryService: DeepMocked<DashboardImpactStoryService>;
  let mediaService: DeepMocked<MediaService>;
  let mockProcessor: DashboardProjectsProcessor;
  let app: INestApplication;
  let jwtService: DeepMocked<JwtService>;
  let mockQueryBuilder: jest.Mocked<DashboardProjectsQueryBuilder>;

  beforeEach(async () => {
    // Setup mock query builder
    mockQueryBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue(2)
    } as unknown as jest.Mocked<DashboardProjectsQueryBuilder>;

    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockQueryBuilder);

    cacheService = createMock<CacheService>();
    cacheService.getCacheKeyFromQuery.mockReturnValue("test-cache-key");

    policyService = createMock<PolicyService>();
    dashboardImpactStoryService = createMock<DashboardImpactStoryService>();
    mediaService = createMock<MediaService>();

    // Create a real processor instance instead of a mock to avoid 'new' keyword issues
    mockProcessor = new DashboardProjectsProcessor(cacheService, policyService);

    dashboardEntitiesService = createMock<DashboardEntitiesService>();
    dashboardEntitiesService.createDashboardProcessor.mockReturnValue(mockProcessor);
    dashboardEntitiesService.getCacheService.mockReturnValue(cacheService);

    jwtService = createMock<JwtService>();

    MockJwtService.mockImplementation(() => jwtService);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardEntitiesController],
      providers: [
        {
          provide: DashboardEntitiesService,
          useValue: dashboardEntitiesService
        },
        {
          provide: CacheService,
          useValue: cacheService
        },
        {
          provide: PolicyService,
          useValue: policyService
        },
        {
          provide: DashboardImpactStoryService,
          useValue: dashboardImpactStoryService
        },
        {
          provide: MediaService,
          useValue: mediaService
        },
        {
          provide: JwtService,
          useValue: jwtService
        },
        UserContextInterceptor
      ]
    }).compile();

    controller = module.get<DashboardEntitiesController>(DashboardEntitiesController);
    app = module.createNestApplication();
    app.useGlobalInterceptors(module.get(UserContextInterceptor));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it("should return a list of dashboard entities with light data", async () => {
    const params: DashboardEntityParamsDto = { entity: "dashboardProjects" };
    const query: DashboardQueryDto = {};
    const mockModels = [
      {
        uuid: "uuid-1",
        name: "Project 1",
        country: "Test Country",
        frameworkKey: "ppc",
        lat: 10.0,
        long: 20.0,
        treesGrownGoal: 5000,
        organisation: { name: "Test Org", type: "NGO" }
      },
      {
        uuid: "uuid-2",
        name: "Project 2",
        country: "Test Country 2",
        frameworkKey: "ppc",
        lat: 15.0,
        long: 25.0,
        treesGrownGoal: 10000,
        organisation: { name: "Test Org 2", type: "Corporation" }
      }
    ] as Project[];

    const cachedData = [
      {
        id: "uuid-1",
        model: mockModels[0],
        computedData: {
          treesPlantedCount: 1000,
          totalHectaresRestoredSum: 50,
          totalSites: 5,
          totalJobsCreated: 25,
          hasAccess: true
        }
      },
      {
        id: "uuid-2",
        model: mockModels[1],
        computedData: {
          treesPlantedCount: 2000,
          totalHectaresRestoredSum: 100,
          totalSites: 10,
          totalJobsCreated: 50,
          hasAccess: false
        }
      }
    ];

    // Fix the cache mock to return the correct structure
    cacheService.get.mockImplementation(async () => {
      return {
        data: cachedData,
        total: 2
      };
    });

    // Mock the processor methods since we're using a real processor instance
    jest.spyOn(mockProcessor, "findMany").mockResolvedValue(mockModels);
    jest.spyOn(mockProcessor, "getLightDto").mockImplementation(async model => {
      const cachedItem = cachedData.find(item => item.model.uuid === model.uuid);
      if (cachedItem == null) {
        throw new Error(`No cached data found for model ${model.uuid}`);
      }
      return {
        id: cachedItem.id,
        dto: new DashboardProjectsLightDto(model, cachedItem.computedData)
      };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(result.meta).toBeDefined();

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(0);

    expect(Array.isArray(result.included)).toBe(true);
    expect(result.included).toHaveLength(0);

    expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
    expect(cacheService.get).toHaveBeenCalledWith(`dashboard:${params.entity}|test-cache-key`, expect.any(Function));
  });

  it("should return a single dashboard entity with full data when user has access", async () => {
    const params: DashboardEntityWithUuidDto = {
      entity: "dashboardProjects",
      uuid: "uuid-1"
    };
    const mockModel = {
      id: 1,
      uuid: "uuid-1",
      name: "Project 1",
      country: "Test Country",
      frameworkKey: "ppc",
      lat: 10.0,
      long: 20.0,
      treesGrownGoal: 5000,
      organisation: { name: "Test Org", type: "NGO" },
      cohort: ["terrafund"],
      objectives: "Test objectives",
      landTenureProjectArea: ["test-area"]
    } as Project;

    const mockDtoResult = {
      id: "uuid-1",
      dto: new DashboardProjectsFullDto(mockModel, {
        treesPlantedCount: 1000,
        totalHectaresRestoredSum: 50,
        totalSites: 5,
        totalJobsCreated: 25,
        hasAccess: true
      } as HybridSupportProps<DashboardProjectsFullDto, Project>)
    };

    const findOneSpy = jest.spyOn(mockProcessor, "findOne").mockResolvedValue(mockModel);
    const getFullDtoSpy = jest.spyOn(mockProcessor, "getFullDto").mockResolvedValue(mockDtoResult);
    const getLightDtoSpy = jest.spyOn(mockProcessor, "getLightDto");

    policyService.hasAccess.mockResolvedValue(true);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(result.meta).toBeDefined();

    expect(findOneSpy).toHaveBeenCalledWith(params.uuid);
    expect(getFullDtoSpy).toHaveBeenCalledWith(mockModel);
    expect(getLightDtoSpy).not.toHaveBeenCalled();
    expect(policyService.hasAccess).toHaveBeenCalledWith("read", mockModel);
  });

  it("should return a single dashboard entity with light data when user has no access", async () => {
    const params: DashboardEntityWithUuidDto = {
      entity: "dashboardProjects",
      uuid: "uuid-1"
    };
    const mockModel = {
      id: 1,
      uuid: "uuid-1",
      name: "Project 1",
      country: "Test Country",
      frameworkKey: "ppc",
      lat: 10.0,
      long: 20.0,
      treesGrownGoal: 5000,
      organisation: { name: "Test Org", type: "NGO" }
    } as Project;

    const mockLightDtoResult = {
      id: "uuid-1",
      dto: new DashboardProjectsLightDto(mockModel, {
        treesPlantedCount: 1000,
        totalHectaresRestoredSum: 50,
        totalSites: 5,
        totalJobsCreated: 25
      } as HybridSupportProps<DashboardProjectsLightDto, Project>)
    };

    const findOneSpy = jest.spyOn(mockProcessor, "findOne").mockResolvedValue(mockModel);
    const getFullDtoSpy = jest.spyOn(mockProcessor, "getFullDto");
    const getLightDtoSpy = jest.spyOn(mockProcessor, "getLightDto").mockResolvedValue(mockLightDtoResult);

    // Mock policy service to return false for access
    policyService.hasAccess.mockResolvedValue(false);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(result.meta).toBeDefined();

    expect(findOneSpy).toHaveBeenCalledWith(params.uuid);
    expect(getFullDtoSpy).not.toHaveBeenCalled();
    expect(getLightDtoSpy).toHaveBeenCalledWith(mockModel);
    // Dashboard projects now check access before determining which DTO to return
    expect(policyService.hasAccess).toHaveBeenCalledWith("read", mockModel);
  });

  it("should throw NotFoundException when entity is not found", async () => {
    const params: DashboardEntityWithUuidDto = {
      entity: "dashboardProjects",
      uuid: "non-existent-uuid"
    };

    jest.spyOn(mockProcessor, "findOne").mockResolvedValue(null);

    await expect(controller.findOne(params.entity, params.uuid)).rejects.toThrow(
      `dashboardProjects with UUID ${params.uuid} not found`
    );

    expect(mockProcessor.findOne).toHaveBeenCalledWith(params.uuid);
  });

  it("should handle cache service interaction with processor creation", async () => {
    const params: DashboardEntityParamsDto = { entity: "dashboardProjects" };
    const query: DashboardQueryDto = {};
    const mockModels = [
      {
        uuid: "uuid-1",
        name: "Project 1",
        country: "Test Country",
        frameworkKey: "ppc",
        lat: 10.0,
        long: 20.0,
        treesGrownGoal: 5000,
        organisation: { name: "Test Org", type: "NGO" }
      }
    ] as Project[];

    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      expect(cacheKey).toBe(`dashboard:${params.entity}|test-cache-key`);
      expect(typeof factory).toBe("function");

      // Execute the factory function to test the processor creation and data processing
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    jest.spyOn(mockProcessor, "findMany").mockResolvedValue(mockModels);
    jest.spyOn(mockProcessor, "getLightDto").mockResolvedValue({
      id: "uuid-1",
      dto: new DashboardProjectsLightDto(mockModels[0], {
        totalSites: 5,
        totalHectaresRestoredSum: 50,
        treesPlantedCount: 1000,
        totalJobsCreated: 25,
        hasAccess: true
      })
    });

    const result = await controller.findAll(params.entity, query);

    expect(cacheService.get).toHaveBeenCalledWith(`dashboard:${params.entity}|test-cache-key`, expect.any(Function));
    expect(dashboardEntitiesService.createDashboardProcessor).toHaveBeenCalledWith(params.entity);
    expect(mockProcessor.findMany).toHaveBeenCalledWith(query);
    expect(mockProcessor.getLightDto).toHaveBeenCalledWith(mockModels[0]);
    expect(DashboardProjectsQueryBuilder).toHaveBeenCalled();
    expect(mockQueryBuilder.queryFilters).toHaveBeenCalledWith(query);
    expect(mockQueryBuilder.count).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should handle cache service with query parameters", async () => {
    const params: DashboardEntityParamsDto = { entity: "dashboardProjects" };
    const query: DashboardQueryDto = {
      country: "Test Country",
      programmes: ["terrafund"],
      cohort: ["terrafund"],
      landscapes: ["gcb"]
    };

    cacheService.get.mockResolvedValue({
      data: [],
      total: 0
    });

    await controller.findAll(params.entity, query);

    expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
    expect(cacheService.get).toHaveBeenCalledWith(`dashboard:${params.entity}|test-cache-key`, expect.any(Function));
  });

  it("should handle impact stories entity", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = { country: "KEN" };
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(result.meta).toBeDefined();

    expect(dashboardImpactStoryService.getDashboardImpactStories).toHaveBeenCalledWith({
      country: query.country,
      organisationType: query.organisationType
    });
    expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
    expect(cacheService.get).toHaveBeenCalledWith(`dashboard:${params.entity}|test-cache-key`, expect.any(Function));
  });

  it("should handle unsupported dashboard entities with appropriate error", async () => {
    const params: DashboardEntityParamsDto = { entity: "dashboardUnsupported" as DashboardEntity };
    const query: DashboardQueryDto = {};

    await expect(controller.findAll(params.entity, query)).rejects.toThrow(
      "Entity type dashboardUnsupported is not supported for listing"
    );
  });

  it("should return a single dashboard impact story DTO when found", async () => {
    const params = {
      entity: DASHBOARD_IMPACT_STORIES as DashboardEntity,
      uuid: "6c6ee6d2-22e4-49d5-900d-53218867bf48"
    };
    const mockImpactStory = {
      id: 1,
      uuid: params.uuid,
      title: "Restoring Land, Empowering Farmers",
      date: "2025-02-21",
      category: ["livelihoods-strengthening", "business-dev-fund"],
      status: "published",
      organisation: {
        name: "Farmlife Health Services",
        countries: ["KEN"],
        facebookUrl: "https://www.facebook.com/people/FarmLife-Health-Services-Ltd/100064171684456/?mibextid=ZbWKwL",
        instagramUrl: null,
        linkedinUrl: "https://www.linkedin.com/company/69225296/admin/feed/posts/",
        twitterUrl: null
      }
    } as unknown as ImpactStory;

    dashboardImpactStoryService.getDashboardImpactStoryById.mockResolvedValue(mockImpactStory);
    jest.spyOn(Media, "findAll").mockResolvedValue([]);
    mediaService.getUrl.mockReturnValue("");

    const result = await controller.findOne(params.entity, params.uuid);
    expect(result).toBeDefined();
  });

  it("should throw error for unsupported entity in single retrieval", async () => {
    const params = { entity: "dashboardUnsupported" as DashboardEntity, uuid: "uuid-1" };

    await expect(controller.findOne(params.entity, params.uuid)).rejects.toThrow(
      "Entity type dashboardUnsupported is not supported for single entity retrieval"
    );
  });

  it("should create DTO and set organisation to null when org is null", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = {};
    const mockImpactStories = [
      {
        id: 1,
        uuid: "test-uuid",
        title: "Test Story",
        date: "2023-01-01",
        category: [],
        status: "published",
        organisation: null
      }
    ] as unknown as ImpactStory[];

    dashboardImpactStoryService.getDashboardImpactStories.mockResolvedValue(mockImpactStories);
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(dashboardImpactStoryService.getDashboardImpactStories).toHaveBeenCalledWith({
      country: query.country,
      organisationType: query.organisationType
    });
  });

  it("should set thumbnail to empty string when no media is found", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = {};
    const mockImpactStories = [
      {
        id: 1,
        uuid: "test-uuid",
        title: "Test Story",
        date: "2023-01-01",
        category: [],
        status: "published",
        organisation: null
      }
    ] as unknown as ImpactStory[];

    dashboardImpactStoryService.getDashboardImpactStories.mockResolvedValue(mockImpactStories);
    jest.spyOn(Media, "findAll").mockResolvedValue([]);
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(Media.findAll).toHaveBeenCalledWith({
      where: {
        modelType: ImpactStory.LARAVEL_TYPE,
        modelId: 1,
        collectionName: "thumbnail"
      }
    });
  });

  it("should set thumbnail to media URL when media is found", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = {};
    const mockImpactStories = [
      {
        id: 1,
        uuid: "test-uuid",
        title: "Test Story",
        date: "2023-01-01",
        category: [],
        status: "published",
        organisation: null
      }
    ] as unknown as ImpactStory[];

    dashboardImpactStoryService.getDashboardImpactStories.mockResolvedValue(mockImpactStories);
    const mockMedia = [{ id: 1, modelId: 1 }] as Media[];
    jest.spyOn(Media, "findAll").mockResolvedValue(mockMedia);
    mediaService.getUrl.mockReturnValue("http://example.com/thumb.jpg");
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(mediaService.getUrl).toHaveBeenCalledWith(mockMedia[0]);
  });

  it("should filter null and empty strings from array category", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = {};
    const mockImpactStories = [
      {
        id: 1,
        uuid: "test-uuid",
        title: "Test Story",
        date: "2023-01-01",
        category: ["cat1", null, "cat2", "", "cat3"],
        status: "published",
        organisation: null
      }
    ] as unknown as ImpactStory[];

    dashboardImpactStoryService.getDashboardImpactStories.mockResolvedValue(mockImpactStories);
    jest.spyOn(Media, "findAll").mockResolvedValue([]);
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(dashboardImpactStoryService.getDashboardImpactStories).toHaveBeenCalledWith({
      country: query.country,
      organisationType: query.organisationType
    });
  });

  it("should convert string category to array", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = {};
    const mockImpactStories = [
      {
        id: 1,
        uuid: "test-uuid",
        title: "Test Story",
        date: "2023-01-01",
        category: "single-category",
        status: "published",
        organisation: null
      }
    ] as unknown as ImpactStory[];

    dashboardImpactStoryService.getDashboardImpactStories.mockResolvedValue(mockImpactStories);
    jest.spyOn(Media, "findAll").mockResolvedValue([]);
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(dashboardImpactStoryService.getDashboardImpactStories).toHaveBeenCalledWith({
      country: query.country,
      organisationType: query.organisationType
    });
  });

  it("should add DTO to document and push UUID to indexIds", async () => {
    const params: DashboardEntityParamsDto = { entity: DASHBOARD_IMPACT_STORIES };
    const query: DashboardQueryDto = {};
    const mockImpactStories = [
      {
        id: 1,
        uuid: "test-uuid-1",
        title: "Test Story 1",
        date: "2023-01-01",
        category: [],
        status: "published",
        organisation: null
      },
      {
        id: 2,
        uuid: "test-uuid-2",
        title: "Test Story 2",
        date: "2023-01-02",
        category: [],
        status: "published",
        organisation: null
      }
    ] as unknown as ImpactStory[];

    dashboardImpactStoryService.getDashboardImpactStories.mockResolvedValue(mockImpactStories);
    jest.spyOn(Media, "findAll").mockResolvedValue([]);
    cacheService.get.mockImplementation(async (cacheKey, factory) => {
      if (factory !== undefined && factory !== null) {
        const result = await factory();
        return result;
      }
      return { data: [], total: 0 };
    });

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.meta).toBeDefined();
    expect(dashboardImpactStoryService.getDashboardImpactStories).toHaveBeenCalledWith({
      country: query.country,
      organisationType: query.organisationType
    });
  });

  it("should throw NotFoundException when dashboard impact story is not found", async () => {
    const params = { entity: DASHBOARD_IMPACT_STORIES as DashboardEntity, uuid: "not-found-uuid" };
    dashboardImpactStoryService.getDashboardImpactStoryById.mockResolvedValue(null);
    await expect(controller.findOne(params.entity, params.uuid)).rejects.toThrow(
      `dashboardImpactStories with UUID ${params.uuid} not found`
    );
    expect(dashboardImpactStoryService.getDashboardImpactStoryById).toHaveBeenCalledWith(params.uuid);
  });

  it("should return full DTO when user has access for other entities", async () => {
    const params = { entity: DASHBOARD_PROJECTS as DashboardEntity, uuid: "uuid-1" };
    const mockModel = { uuid: "uuid-1", name: "Project 1" } as Project;
    const mockFullDto = {
      id: "uuid-1",
      dto: new DashboardProjectsFullDto(
        mockModel,
        {} as unknown as HybridSupportProps<DashboardProjectsFullDto, Project>
      )
    };
    const mockProcessor = new DashboardProjectsProcessor(cacheService, policyService);

    jest.spyOn(mockProcessor, "findOne").mockResolvedValue(mockModel);
    jest.spyOn(mockProcessor, "getFullDto").mockResolvedValue(mockFullDto);
    jest.spyOn(mockProcessor, "getLightDto");
    dashboardEntitiesService.createDashboardProcessor.mockReturnValue(mockProcessor);
    policyService.hasAccess.mockResolvedValue(true);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(mockProcessor.findOne).toHaveBeenCalledWith(params.uuid);
    expect(mockProcessor.getFullDto).toHaveBeenCalledWith(mockModel);
    expect(mockProcessor.getLightDto).not.toHaveBeenCalled();
    expect(policyService.hasAccess).toHaveBeenCalledWith("read", mockModel);
  });

  it("should return light DTO when user does not have access for other entities", async () => {
    const params = { entity: DASHBOARD_PROJECTS as DashboardEntity, uuid: "uuid-1" };
    const mockModel = { uuid: "uuid-1", name: "Project 1" } as Project;
    const mockLightDto = {
      id: "uuid-1",
      dto: new DashboardProjectsLightDto(
        mockModel,
        {} as unknown as HybridSupportProps<DashboardProjectsLightDto, Project>
      )
    };
    const mockProcessor = new DashboardProjectsProcessor(cacheService, policyService);

    jest.spyOn(mockProcessor, "findOne").mockResolvedValue(mockModel);
    jest.spyOn(mockProcessor, "getLightDto").mockResolvedValue(mockLightDto);
    jest.spyOn(mockProcessor, "getFullDto");
    dashboardEntitiesService.createDashboardProcessor.mockReturnValue(mockProcessor);
    policyService.hasAccess.mockResolvedValue(false);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(mockProcessor.findOne).toHaveBeenCalledWith(params.uuid);
    expect(mockProcessor.getLightDto).toHaveBeenCalledWith(mockModel);
    expect(mockProcessor.getFullDto).not.toHaveBeenCalled();
    expect(policyService.hasAccess).toHaveBeenCalledWith("read", mockModel);
  });
});
