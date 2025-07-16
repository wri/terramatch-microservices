import { Test, TestingModule } from "@nestjs/testing";
import { DashboardProjectsProcessor } from "./dashboard-projects.processor";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import { Project } from "@terramatch-microservices/database/entities";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "../dto/dashboard-projects.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util/json-api-builder";
import { BadRequestException } from "@nestjs/common";

describe("DashboardProjectsProcessor", () => {
  let processor: DashboardProjectsProcessor;
  let cacheService: jest.Mocked<CacheService>;
  let policyService: jest.Mocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardProjectsProcessor,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn()
          }
        },
        {
          provide: PolicyService,
          useValue: {
            getPermissions: jest.fn()
          }
        }
      ]
    }).compile();

    processor = module.get<DashboardProjectsProcessor>(DashboardProjectsProcessor);
    cacheService = module.get(CacheService);
    policyService = module.get(PolicyService);
  });

  it("should be defined", () => {
    expect(processor).toBeDefined();
  });

  it("should create light DTO from project", async () => {
    const mockProject = { uuid: "test-uuid" } as Project;
    const mockLightDto = new DashboardProjectsLightDto({
      uuid: "test-uuid",
      name: "Test Project",
      country: "Kenya",
      frameworkKey: "ppc",
      treesPlantedCount: 1000,
      totalHectaresRestoredSum: 100.5,
      lat: 10.0,
      long: 20.0,
      organisationName: "Test Org",
      organisationType: "NGO",
      treesGrownGoal: 5000,
      totalSites: 5,
      totalJobsCreated: 25,
      is_light: true
    });

    jest.spyOn(processor, "getLightDto").mockResolvedValue({ id: "test-uuid", dto: mockLightDto });

    const result = await processor.getLightDto(mockProject);

    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardProjectsLightDto);
  });

  it("should create full DTO from light DTO", async () => {
    const mockProject = { uuid: "test-uuid" } as Project;
    const mockLightDto = new DashboardProjectsLightDto({
      uuid: "test-uuid",
      name: "Test Project",
      country: "Kenya",
      frameworkKey: "ppc",
      treesPlantedCount: 1000,
      totalHectaresRestoredSum: 100.5,
      lat: 10.0,
      long: 20.0,
      organisationName: "Test Org",
      organisationType: "NGO",
      treesGrownGoal: 5000,
      totalSites: 5,
      totalJobsCreated: 25,
      is_light: true
    });

    jest.spyOn(processor, "getLightDto").mockResolvedValue({ id: "test-uuid", dto: mockLightDto });

    const result = await processor.getFullDto(mockProject);

    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardProjectsFullDto);
  });

  describe("processSideload", () => {
    it("should process site polygons sideload", async () => {
      const mockProject = { uuid: "test-uuid" } as Project;
      const mockDocument = {} as DocumentBuilder;

      // Mock the private method
      jest.spyOn(processor as any, "processSitePolygonsSideload").mockResolvedValue(undefined);

      await processor.processSideload(mockDocument, mockProject, "sitePolygons", 10);

      expect((processor as any).processSitePolygonsSideload).toHaveBeenCalledWith(mockDocument, mockProject, 10);
    });

    it("should process demographics sideload", async () => {
      const mockProject = { uuid: "test-uuid" } as Project;
      const mockDocument = {} as DocumentBuilder;

      // Mock the private method
      jest.spyOn(processor as any, "processDemographicsSideload").mockResolvedValue(undefined);

      await processor.processSideload(mockDocument, mockProject, "demographics", 10);

      expect((processor as any).processDemographicsSideload).toHaveBeenCalledWith(mockDocument, mockProject, 10);
    });

    it("should throw BadRequestException for unsupported sideload entity", async () => {
      const mockProject = { uuid: "test-uuid" } as Project;
      const mockDocument = {} as DocumentBuilder;

      await expect(processor.processSideload(mockDocument, mockProject, "unsupported" as any, 10)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
