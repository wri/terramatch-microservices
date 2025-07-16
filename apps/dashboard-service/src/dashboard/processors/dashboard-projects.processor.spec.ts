import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardProjectsProcessor } from "./dashboard-projects.processor";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import {
  Project,
  Site,
  SitePolygon,
  TreeSpecies,
  SiteReport,
  DemographicEntry,
  Demographic,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "../dto/dashboard-projects.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

describe("DashboardProjectsProcessor", () => {
  let processor: DashboardProjectsProcessor;
  let cacheService: DeepMocked<CacheService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();
    policyService = createMock<PolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DashboardProjectsProcessor,
          useFactory: () => new DashboardProjectsProcessor(cacheService, policyService)
        },
        {
          provide: CacheService,
          useValue: cacheService
        },
        {
          provide: PolicyService,
          useValue: policyService
        }
      ]
    }).compile();

    processor = module.get<DashboardProjectsProcessor>(DashboardProjectsProcessor);
  });

  it("should have correct DTO types", () => {
    expect(processor.LIGHT_DTO).toBeDefined();
    expect(processor.FULL_DTO).toBeDefined();
  });

  it("should find one project by UUID", async () => {
    const mockProject = { uuid: "test-uuid", name: "Test Project" } as Project;

    jest.spyOn(Project, "findOne").mockResolvedValue(mockProject);

    const result = await processor.findOne("test-uuid");

    expect(Project.findOne).toHaveBeenCalledWith({
      where: { uuid: "test-uuid" },
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type"]
        }
      ]
    });
    expect(result).toBe(mockProject);
  });

  it("should find many projects with query filters", async () => {
    const mockProjects = [
      { uuid: "uuid-1", name: "Project 1" } as Project,
      { uuid: "uuid-2", name: "Project 2" } as Project
    ];
    const query = { country: "Kenya" };

    const mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(mockProjects)
    };
    jest
      .spyOn(require("../dashboard-query.builder"), "DashboardProjectsQueryBuilder")
      .mockImplementation(() => mockBuilder);

    const result = await processor.findMany(query);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(query);
    expect(mockBuilder.execute).toHaveBeenCalled();
    expect(result).toBe(mockProjects);
  });

  it("should create light DTO with aggregated data", async () => {
    const mockProject = {
      id: 1,
      uuid: "test-uuid",
      name: "Test Project",
      country: "Kenya",
      frameworkKey: "ppc",
      lat: 10.0,
      long: 20.0,
      treesGrownGoal: 5000,
      organisation: { name: "Test Org", type: "NGO" }
    } as Project;

    jest.spyOn(Site, "approvedIdsSubquery").mockReturnValue("query1" as never);
    jest.spyOn(SiteReport, "approvedIdsSubquery").mockReturnValue("query2" as never);
    jest.spyOn(Site, "approved").mockReturnValue({
      project: jest.fn().mockReturnValue({ count: jest.fn().mockResolvedValue(5) })
    } as never);
    jest.spyOn(SitePolygon, "active").mockReturnValue({
      approved: jest.fn().mockReturnValue({
        sites: jest.fn().mockReturnValue({ sum: jest.fn().mockResolvedValue(100.5) })
      })
    } as never);
    jest.spyOn(TreeSpecies, "visible").mockReturnValue({
      collection: jest.fn().mockReturnValue({
        siteReports: jest.fn().mockReturnValue({ sum: jest.fn().mockResolvedValue(1000) })
      })
    } as never);
    jest.spyOn(ProjectReport, "approvedIdsSubquery").mockReturnValue("query3" as never);
    jest.spyOn(Demographic, "idsSubquery").mockReturnValue("query4" as never);
    jest.spyOn(DemographicEntry, "gender").mockReturnValue({
      sum: jest.fn().mockResolvedValue(25)
    } as never);

    const result = await processor.getLightDto(mockProject);

    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardProjectsLightDto);
  });

  it("should create full DTO from light DTO", async () => {
    const mockProject = {
      uuid: "test-uuid",
      name: "Test Project",
      country: "Kenya",
      frameworkKey: "ppc",
      lat: 10.0,
      long: 20.0,
      treesGrownGoal: 5000,
      organisation: { name: "Test Org", type: "NGO" }
    } as Project;
    const mockLightDto = new DashboardProjectsLightDto(mockProject, {
      treesPlantedCount: 1000,
      totalHectaresRestoredSum: 100.5,
      totalSites: 5,
      totalJobsCreated: 25
    } as HybridSupportProps<DashboardProjectsLightDto, Project>);

    jest.spyOn(processor, "getLightDto").mockResolvedValue({ id: "test-uuid", dto: mockLightDto });

    const result = await processor.getFullDto(mockProject);

    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardProjectsFullDto);
  });
});
