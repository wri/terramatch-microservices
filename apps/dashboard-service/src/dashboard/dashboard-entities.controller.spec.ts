import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardEntitiesController } from "./dashboard-entities.controller";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";
import { CacheService } from "./dto/cache.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardEntityParamsDto, DashboardEntityWithUuidDto } from "./dto/dashboard-entity.dto";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "./dto/dashboard-projects.dto";
import { Project } from "@terramatch-microservices/database/entities";
import { DashboardAuthService } from "./services/dashboard-auth.service";

describe("DashboardEntitiesController", () => {
  let controller: DashboardEntitiesController;
  let dashboardEntitiesService: DeepMocked<DashboardEntitiesService>;
  let cacheService: DeepMocked<CacheService>;
  let dashboardAuthService: DeepMocked<DashboardAuthService>;
  let mockProcessor: DeepMocked<DashboardProjectsProcessor>;

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

    dashboardAuthService = createMock<DashboardAuthService>();

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
          provide: DashboardAuthService,
          useValue: dashboardAuthService
        }
      ]
    }).compile();

    controller = module.get<DashboardEntitiesController>(DashboardEntitiesController);
  });

  it("should return a list of dashboard entities with light data", async () => {
    const params: DashboardEntityParamsDto = { entity: "dashboardProjects" };
    const query: DashboardQueryDto = {};
    const mockModels = [{ uuid: "uuid-1" }, { uuid: "uuid-2" }] as Project[];
    const mockDtoResults = [
      {
        id: "uuid-1",
        dto: new DashboardProjectsLightDto({
          uuid: "uuid-1",
          name: "Project 1",
          country: "Test Country",
          frameworkKey: "ppc",
          treesPlantedCount: 1000,
          totalHectaresRestoredSum: 50,
          lat: 10.0,
          long: 20.0,
          organisationName: "Test Org",
          organisationType: "NGO",
          treesGrownGoal: 5000,
          totalSites: 5,
          totalJobsCreated: 25,
          is_light: true
        })
      },
      {
        id: "uuid-2",
        dto: new DashboardProjectsLightDto({
          uuid: "uuid-2",
          name: "Project 2",
          country: "Test Country 2",
          frameworkKey: "ppc",
          treesPlantedCount: 2000,
          totalHectaresRestoredSum: 100,
          lat: 15.0,
          long: 25.0,
          organisationName: "Test Org 2",
          organisationType: "Corporation",
          treesGrownGoal: 10000,
          totalSites: 10,
          totalJobsCreated: 50,
          is_light: true
        })
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
    const mockModel = { uuid: "uuid-1" } as Project;
    const mockDtoResult = {
      id: "uuid-1",
      dto: new DashboardProjectsFullDto({
        uuid: "uuid-1",
        name: "Project 1",
        country: "Test Country",
        frameworkKey: "ppc",
        treesPlantedCount: 1000,
        totalHectaresRestoredSum: 50,
        lat: 10.0,
        long: 20.0,
        organisationName: "Test Org",
        organisationType: "NGO",
        treesGrownGoal: 5000,
        totalSites: 5,
        totalJobsCreated: 25,
        cohort: ["terrafund"],
        objectives: "Test objectives",
        landTenureProjectArea: ["test-area"],
        is_light: false
      })
    };

    mockProcessor.findOne.mockResolvedValue(mockModel);
    mockProcessor.getFullDto.mockResolvedValue(mockDtoResult);
    dashboardAuthService.checkUserProjectAccess.mockResolvedValue({ allowed: true });

    const result = await controller.findOne(params.entity, params.uuid, null);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it("should return a single dashboard entity with light data when user has no access", async () => {
    const params: DashboardEntityWithUuidDto = {
      entity: "dashboardProjects",
      uuid: "uuid-1"
    };
    const mockModel = { uuid: "uuid-1" } as Project;
    const mockLightDtoResult = {
      id: "uuid-1",
      dto: new DashboardProjectsLightDto({
        uuid: "uuid-1",
        name: "Project 1",
        country: "Test Country",
        frameworkKey: "ppc",
        treesPlantedCount: 1000,
        totalHectaresRestoredSum: 50,
        lat: 10.0,
        long: 20.0,
        organisationName: "Test Org",
        organisationType: "NGO",
        treesGrownGoal: 5000,
        totalSites: 5,
        totalJobsCreated: 25,
        is_light: true
      })
    };

    mockProcessor.findOne.mockResolvedValue(mockModel);
    mockProcessor.getLightDto.mockResolvedValue(mockLightDtoResult);
    dashboardAuthService.checkUserProjectAccess.mockResolvedValue({ allowed: false });

    const result = await controller.findOne(params.entity, params.uuid, null);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.included).toBeDefined();
    expect(Array.isArray(result.included)).toBe(true);
    expect(result.included).toHaveLength(1);

    expect(mockProcessor.getLightDto).toHaveBeenCalledWith(mockModel);
    expect(mockProcessor.getFullDto).not.toHaveBeenCalled();
  });
});
