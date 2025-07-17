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
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { User, Permission } from "@terramatch-microservices/database/entities";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { UserContextInterceptor } from "./interceptors/user-context.interceptor";
import { RequestContext } from "nestjs-request-context";

jest.mock("@nestjs/jwt");
const MockJwtService = JwtService as jest.MockedClass<typeof JwtService>;

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
  let mockProcessor: DeepMocked<DashboardProjectsProcessor>;
  let app: INestApplication;
  let jwtService: DeepMocked<JwtService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();
    cacheService.getCacheKeyFromQuery.mockReturnValue("test-cache-key");

    mockProcessor = createMock<DashboardProjectsProcessor>();
    Object.defineProperty(mockProcessor, "LIGHT_DTO", {
      value: DashboardProjectsLightDto,
      writable: false,
      configurable: true
    });
    Object.defineProperty(mockProcessor, "FULL_DTO", {
      value: DashboardProjectsFullDto,
      writable: false,
      configurable: true
    });

    dashboardEntitiesService = createMock<DashboardEntitiesService>();
    dashboardEntitiesService.createDashboardProcessor.mockReturnValue(mockProcessor);
    dashboardEntitiesService.getCacheService.mockReturnValue(cacheService);

    policyService = createMock<PolicyService>();
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
    const mockDtoResults = [
      {
        id: "uuid-1",
        dto: new DashboardProjectsLightDto(mockModels[0], {
          treesPlantedCount: 1000,
          totalHectaresRestoredSum: 50,
          totalSites: 5,
          totalJobsCreated: 25
        } as HybridSupportProps<DashboardProjectsLightDto, Project>)
      },
      {
        id: "uuid-2",
        dto: new DashboardProjectsLightDto(mockModels[1], {
          treesPlantedCount: 2000,
          totalHectaresRestoredSum: 100,
          totalSites: 10,
          totalJobsCreated: 50
        } as HybridSupportProps<DashboardProjectsLightDto, Project>)
      }
    ];

    cacheService.get.mockImplementation(async (key, factory) => {
      if (factory !== null && factory !== undefined) {
        return await factory();
      }
      return null;
    });

    mockProcessor.findMany.mockResolvedValue(mockModels);
    mockProcessor.getLightDtos.mockResolvedValue(mockDtoResults);

    const result = await controller.findAll(params.entity, query);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(result.meta).toBeDefined();

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(0);

    expect(Array.isArray(result.included)).toBe(true);
    expect(result.included).toHaveLength(2);
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

    mockProcessor.findOne.mockResolvedValue(mockModel);
    mockProcessor.getFullDto.mockResolvedValue(mockDtoResult);
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

    mockProcessor.findOne.mockResolvedValue(mockModel);
    mockProcessor.getLightDto.mockResolvedValue(mockLightDtoResult);
    policyService.hasAccess.mockResolvedValue(false);

    const result = await controller.findOne(params.entity, params.uuid);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(Array.isArray(result.included)).toBe(true);
    expect(result.included).toHaveLength(1);

    expect(mockProcessor.getLightDto).toHaveBeenCalledWith(mockModel);
    expect(mockProcessor.getFullDto).not.toHaveBeenCalled();
  });
});
