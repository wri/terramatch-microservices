import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { createMock } from "@golevelup/ts-jest";
import { Project, Seeding, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { AggregateReportsService } from "./aggregate-reports.service";

describe("AggregateReportsService", () => {
  let service: AggregateReportsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AggregateReportsService]
    }).compile();

    service = module.get(AggregateReportsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getAggregateReports", () => {
    it("throws BadRequestException when entity has no framework", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: null });

      await expect(service.getAggregateReports("projects", project)).rejects.toThrow(BadRequestException);
      await expect(service.getAggregateReports("projects", project)).rejects.toThrow(
        "Entity has no framework; aggregate reports are not supported."
      );
    });

    it("throws BadRequestException when framework is not supported", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: "epa-ghana-pilot" });

      await expect(service.getAggregateReports("projects", project)).rejects.toThrow(BadRequestException);
      await expect(service.getAggregateReports("projects", project)).rejects.toThrow(
        /Unsupported framework for aggregate reports/
      );
    });

    it("returns only framework-allowed keys for terrafund (no seedingRecords)", async () => {
      const project = Project.build({ id: 1, frameworkKey: "terrafund" });
      const reportInstance = createMock<SiteReport>({
        id: 1,
        dueAt: new Date("2024-06-30"),
        numTreesRegenerating: 10
      });

      const mockFindAll = jest.fn().mockResolvedValue([reportInstance]);
      const mockSites = jest.fn().mockReturnValue({
        findAll: mockFindAll
      });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);
      jest.spyOn(Site, "approvedIdsSubquery").mockReturnValue(undefined as never);
      jest.spyOn(TreeSpecies, "visible").mockReturnValue({
        collection: jest.fn().mockReturnValue({
          siteReports: jest.fn().mockReturnValue({
            findAll: jest.fn().mockResolvedValue([])
          })
        })
      } as unknown as ReturnType<typeof TreeSpecies.visible>);
      jest.spyOn(Seeding, "visible").mockReturnValue({
        siteReports: jest.fn().mockReturnValue({
          findAll: jest.fn().mockResolvedValue([])
        })
      } as unknown as ReturnType<typeof Seeding.visible>);

      const result = await service.getAggregateReports("projects", project);

      expect(result.treePlanted).toBeDefined();
      expect(result.treesRegenerating).toBeDefined();
      expect(result.seedingRecords).toBeUndefined();
      expect(Array.isArray(result.treePlanted)).toBe(true);
      expect(Array.isArray(result.treesRegenerating)).toBe(true);
      if (result.treesRegenerating != null && result.treesRegenerating.length > 0) {
        expect(result.treesRegenerating[0]).toMatchObject({
          dueDate: "2024-06-30T00:00:00.000Z",
          aggregateAmount: 10
        });
      }
    });

    it("returns only treePlanted and treesRegenerating for terrafund-landscapes", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: "terrafund-landscapes" });
      const mockFindAll = jest.fn().mockResolvedValue([]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const result = await service.getAggregateReports("projects", project);

      expect(result.treePlanted).toEqual([]);
      expect(result.treesRegenerating).toEqual([]);
      expect(result.seedingRecords).toBeUndefined();
    });

    it("returns only treePlanted and treesRegenerating for enterprises", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: "enterprises" });
      const mockFindAll = jest.fn().mockResolvedValue([]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const result = await service.getAggregateReports("projects", project);

      expect(result.treePlanted).toEqual([]);
      expect(result.treesRegenerating).toEqual([]);
      expect(result.seedingRecords).toBeUndefined();
    });

    it("returns empty arrays when entity has no approved site reports", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: "terrafund" });

      const mockFindAll = jest.fn().mockResolvedValue([]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const result = await service.getAggregateReports("projects", project);

      expect(result.treePlanted).toEqual([]);
      expect(result.treesRegenerating).toEqual([]);
    });

    it("filters out reports with null dueAt from series", async () => {
      const project = Project.build({ id: 1, frameworkKey: "terrafund" });
      const reportWithDue = createMock<SiteReport>({
        id: 1,
        dueAt: new Date("2024-06-30"),
        numTreesRegenerating: 5
      });
      const reportNullDue = createMock<SiteReport>({
        id: 2,
        dueAt: null,
        numTreesRegenerating: 10
      });

      const mockFindAll = jest.fn().mockResolvedValue([reportWithDue, reportNullDue]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);
      jest.spyOn(Site, "approvedIdsSubquery").mockReturnValue(undefined as never);
      jest.spyOn(TreeSpecies, "visible").mockReturnValue({
        collection: jest.fn().mockReturnValue({
          siteReports: jest.fn().mockReturnValue({ findAll: jest.fn().mockResolvedValue([]) })
        })
      } as unknown as ReturnType<typeof TreeSpecies.visible>);
      jest.spyOn(Seeding, "visible").mockReturnValue({
        siteReports: jest.fn().mockReturnValue({ findAll: jest.fn().mockResolvedValue([]) })
      } as unknown as ReturnType<typeof Seeding.visible>);

      const result = await service.getAggregateReports("projects", project);

      expect(result.treePlanted).toBeDefined();
      expect(Array.isArray(result.treePlanted)).toBe(true);
      expect(result.treesRegenerating).toHaveLength(1);
      expect(result.treesRegenerating != null && result.treesRegenerating[0].aggregateAmount).toBe(5);
    });

    it("returns period series (one point per unique due_at, sum per period) matching V2 with camelCase", async () => {
      const site = Site.build({ id: 1, projectId: 1, frameworkKey: "ppc" });
      const report1 = createMock<SiteReport>({
        id: 10,
        dueAt: new Date("2024-06-30"),
        numTreesRegenerating: 5
      });
      const report2 = createMock<SiteReport>({
        id: 11,
        dueAt: new Date("2024-12-31"),
        numTreesRegenerating: 3
      });

      const mockFindAll = jest.fn().mockResolvedValue([report1, report2]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const mockTreeFindAll = jest.fn().mockResolvedValue([
        { speciesableId: 10, total: 100 },
        { speciesableId: 11, total: 50 }
      ]);
      jest.spyOn(TreeSpecies, "visible").mockReturnValue({
        collection: jest.fn().mockReturnValue({
          siteReports: jest.fn().mockReturnValue({ findAll: mockTreeFindAll })
        })
      } as unknown as ReturnType<typeof TreeSpecies.visible>);

      const mockSeedingFindAll = jest.fn().mockResolvedValue([
        { seedableId: 10, total: 20 },
        { seedableId: 11, total: 30 }
      ]);
      jest.spyOn(Seeding, "visible").mockReturnValue({
        siteReports: jest.fn().mockReturnValue({ findAll: mockSeedingFindAll })
      } as unknown as ReturnType<typeof Seeding.visible>);

      const result = await service.getAggregateReports("sites", site);

      expect(result.treePlanted).toBeDefined();
      expect(result.seedingRecords).toBeDefined();
      expect(result.treesRegenerating).toBeDefined();

      const treePlanted = result.treePlanted;
      if (treePlanted != null && treePlanted.length >= 2) {
        expect(treePlanted[0].aggregateAmount).toBe(100);
        expect(treePlanted[1].aggregateAmount).toBe(50);
      }

      const seeding = result.seedingRecords;
      if (seeding != null && seeding.length >= 2) {
        expect(seeding[0].aggregateAmount).toBe(20);
        expect(seeding[1].aggregateAmount).toBe(30);
      }

      const regenerating = result.treesRegenerating;
      if (regenerating != null && regenerating.length >= 2) {
        expect(regenerating[0].aggregateAmount).toBe(5);
        expect(regenerating[1].aggregateAmount).toBe(3);
      }
    });

    it("returns all three series for hbf framework", async () => {
      const site = createMock<Site>({ id: 1, frameworkKey: "hbf" });
      const mockFindAll = jest.fn().mockResolvedValue([]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const result = await service.getAggregateReports("sites", site);

      expect(result.treePlanted).toEqual([]);
      expect(result.seedingRecords).toEqual([]);
      expect(result.treesRegenerating).toEqual([]);
    });

    it("sums amounts for multiple reports with the same due_at (one point per period)", async () => {
      const project = Project.build({ id: 1, frameworkKey: "terrafund" });
      const sameDue = new Date("2024-06-30");
      const report1 = createMock<SiteReport>({ id: 1, dueAt: sameDue, numTreesRegenerating: 5 });
      const report2 = createMock<SiteReport>({ id: 2, dueAt: sameDue, numTreesRegenerating: 10 });

      const mockFindAll = jest.fn().mockResolvedValue([report1, report2]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);
      jest.spyOn(Site, "approvedIdsSubquery").mockReturnValue(undefined as never);
      jest.spyOn(TreeSpecies, "visible").mockReturnValue({
        collection: jest.fn().mockReturnValue({
          siteReports: jest.fn().mockReturnValue({ findAll: jest.fn().mockResolvedValue([]) })
        })
      } as unknown as ReturnType<typeof TreeSpecies.visible>);
      jest.spyOn(Seeding, "visible").mockReturnValue({
        siteReports: jest.fn().mockReturnValue({ findAll: jest.fn().mockResolvedValue([]) })
      } as unknown as ReturnType<typeof Seeding.visible>);

      const result = await service.getAggregateReports("projects", project);

      expect(result.treesRegenerating).toHaveLength(1);
      expect(result.treesRegenerating != null && result.treesRegenerating[0].aggregateAmount).toBe(15);
    });

    it("returns empty series when entityType is not projects or sites (e.g. unsupported)", async () => {
      const project = Project.build({ id: 1, frameworkKey: "terrafund" });
      const mockFindAll = jest.fn().mockResolvedValue([]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const result = await service.getAggregateReports("nurseries" as "projects", project);

      expect(result.treePlanted).toEqual([]);
      expect(result.treesRegenerating).toEqual([]);
    });
  });
});
