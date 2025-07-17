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

jest.mock("@nestjs/jwt");
const MockJwtService = JwtService as jest.MockedClass<typeof JwtService>;

// Mock the json-api-builder module
jest.mock("@terramatch-microservices/common/util/json-api-builder", () => ({
  buildJsonApi: jest.fn().mockImplementation(() => ({
    addData: jest.fn().mockReturnThis(),
    serialize: jest.fn().mockReturnValue({
      data: [],
      included: [],
      meta: { resourceType: "dashboardProjects" }
    })
  })),
  getStableRequestQuery: jest.fn().mockImplementation(query => query)
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
  let mockProcessor: DashboardProjectsProcessor;
  let app: INestApplication;
  let jwtService: DeepMocked<JwtService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();
    cacheService.getCacheKeyFromQuery.mockReturnValue("test-cache-key");

    policyService = createMock<PolicyService>();

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

    // Mock the cache to return the new structure with models and computed data
    const cachedData = [
      {
        id: "uuid-1",
        model: mockModels[0],
        computedData: {
          treesPlantedCount: 1000,
          totalHectaresRestoredSum: 50,
          totalSites: 5,
          totalJobsCreated: 25
        }
      },
      {
        id: "uuid-2",
        model: mockModels[1],
        computedData: {
          treesPlantedCount: 2000,
          totalHectaresRestoredSum: 100,
          totalSites: 10,
          totalJobsCreated: 50
        }
      }
    ];

    cacheService.get.mockImplementation(async () => {
      return cachedData;
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
  });

  it("should return a single dashboard entity with full data", async () => {
    const params: DashboardEntityWithUuidDto = {
      entity: "dashboardProjects",
      uuid: "uuid-1"
    };
    const mockModel = {
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
        totalJobsCreated: 25
      } as HybridSupportProps<DashboardProjectsFullDto, Project>)
    };

    jest.spyOn(mockProcessor, "findOne").mockResolvedValue(mockModel);
    jest.spyOn(mockProcessor, "getFullDto").mockResolvedValue(mockDtoResult);
    policyService.hasAccess.mockResolvedValue(true);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it("should return a single dashboard entity with light data when user has no access", async () => {
    const params: DashboardEntityWithUuidDto = {
      entity: "dashboardProjects",
      uuid: "uuid-1"
    };
    const mockModel = {
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
    const getLightDtoSpy = jest.spyOn(mockProcessor, "getLightDto").mockResolvedValue(mockLightDtoResult);
    const getFullDtoSpy = jest.spyOn(mockProcessor, "getFullDto");
    policyService.hasAccess.mockResolvedValue(false);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(Array.isArray(result.included)).toBe(true);
    expect(result.included).toHaveLength(0);

    expect(findOneSpy).toHaveBeenCalledWith(mockModel.uuid);
    expect(getLightDtoSpy).toHaveBeenCalledWith(mockModel);
    expect(getFullDtoSpy).not.toHaveBeenCalled();
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
      return [];
    });

    jest.spyOn(mockProcessor, "findMany").mockResolvedValue(mockModels);
    jest.spyOn(mockProcessor, "getLightDto").mockResolvedValue({
      id: "uuid-1",
      dto: new DashboardProjectsLightDto(mockModels[0], {
        totalSites: 5,
        totalHectaresRestoredSum: 50,
        treesPlantedCount: 1000,
        totalJobsCreated: 25
      })
    });

    const result = await controller.findAll(params.entity, query);

    expect(cacheService.get).toHaveBeenCalledWith(`dashboard:${params.entity}|test-cache-key`, expect.any(Function));
    expect(dashboardEntitiesService.createDashboardProcessor).toHaveBeenCalledWith(params.entity);
    expect(mockProcessor.findMany).toHaveBeenCalledWith(query);
    expect(mockProcessor.getLightDto).toHaveBeenCalledWith(mockModels[0]);
    expect(result).toBeDefined();
  });
});
