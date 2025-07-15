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
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";

// Mock JwtService constructor
jest.mock("@nestjs/jwt");
const MockJwtService = JwtService as jest.MockedClass<typeof JwtService>;

jest.mock("@terramatch-microservices/database/entities", () => ({
  ...jest.requireActual("@terramatch-microservices/database/entities"),
  User: {
    findOne: jest.fn()
  }
}));

describe("DashboardEntitiesController", () => {
  let controller: DashboardEntitiesController;
  let dashboardEntitiesService: DeepMocked<DashboardEntitiesService>;
  let cacheService: DeepMocked<CacheService>;
  let dashboardAuthService: DeepMocked<DashboardAuthService>;
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

    dashboardAuthService = createMock<DashboardAuthService>();
    jwtService = createMock<JwtService>();

    // Mock JwtService constructor
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
          provide: DashboardAuthService,
          useValue: dashboardAuthService
        },
        {
          provide: JwtService,
          useValue: jwtService
        }
      ]
    }).compile();

    controller = module.get<DashboardEntitiesController>(DashboardEntitiesController);
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
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

  describe("Integration tests with CurrentUser decorator", () => {
    const mockUser = {
      id: 123,
      emailAddress: "test@example.com",
      firstName: "Test",
      lastName: "User",
      organisationId: 1,
      program: "test-program",
      country: "Test Country",
      roles: [{ id: 1, name: "admin" }],
      organisation: { id: 1, uuid: "org-uuid", name: "Test Org" },
      projects: [{ id: 1, userProjects: { isManaging: true, isMonitoring: false } }]
    };

    beforeEach(() => {
      process.env.JWT_SECRET = "test-secret";
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it("should return full data when user has valid JWT and access", async () => {
      const mockToken = "valid.jwt.token";
      const mockPayload = { sub: 123 };
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

      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      mockProcessor.findOne.mockResolvedValue(mockModel);
      mockProcessor.getFullDto.mockResolvedValue(mockDtoResult);
      dashboardAuthService.checkUserProjectAccess.mockResolvedValue({ allowed: true });

      const response = await request(app.getHttpServer())
        .get("/dashboard/v3/dashboardProjects/uuid-1")
        .set("Authorization", `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken);
      expect(User.findOne).toHaveBeenCalled();
      expect(mockProcessor.getFullDto).toHaveBeenCalled();
    });

    it("should return light data when user has valid JWT but no access", async () => {
      const mockToken = "valid.jwt.token";
      const mockPayload = { sub: 123 };
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

      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      mockProcessor.findOne.mockResolvedValue(mockModel);
      mockProcessor.getLightDto.mockResolvedValue(mockLightDtoResult);
      dashboardAuthService.checkUserProjectAccess.mockResolvedValue({ allowed: false });

      const response = await request(app.getHttpServer())
        .get("/dashboard/v3/dashboardProjects/uuid-1")
        .set("Authorization", `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken);
      expect(User.findOne).toHaveBeenCalled();
      expect(mockProcessor.getLightDto).toHaveBeenCalled();
    });

    it("should return light data when no authorization header is present", async () => {
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

      const response = await request(app.getHttpServer()).get("/dashboard/v3/dashboardProjects/uuid-1").expect(200);

      expect(response.body).toBeDefined();
      expect(mockProcessor.getLightDto).toHaveBeenCalled();
    });

    it("should return light data when JWT verification fails", async () => {
      const mockToken = "invalid.jwt.token";
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

      jwtService.verifyAsync.mockRejectedValue(new Error("Invalid token"));

      mockProcessor.findOne.mockResolvedValue(mockModel);
      mockProcessor.getLightDto.mockResolvedValue(mockLightDtoResult);
      dashboardAuthService.checkUserProjectAccess.mockResolvedValue({ allowed: false });

      const response = await request(app.getHttpServer())
        .get("/dashboard/v3/dashboardProjects/uuid-1")
        .set("Authorization", `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(mockProcessor.getLightDto).toHaveBeenCalled();
    });
  });
});
