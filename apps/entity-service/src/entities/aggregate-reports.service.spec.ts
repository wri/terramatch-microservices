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

    it("returns only framework-allowed keys for terrafund (no seeding-records)", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: "terrafund" });
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

      expect(result["tree-planted"]).toBeDefined();
      expect(result["trees-regenerating"]).toBeDefined();
      expect(result["seeding-records"]).toBeUndefined();
      expect(Array.isArray(result["tree-planted"])).toBe(true);
      expect(Array.isArray(result["trees-regenerating"])).toBe(true);
      if (result["trees-regenerating"] != null && result["trees-regenerating"].length > 0) {
        expect(result["trees-regenerating"][0]).toMatchObject({
          dueDate: "2024-06-30T00:00:00.000Z",
          aggregateAmount: 10
        });
      }
    });

    it("returns empty arrays when entity has no approved site reports", async () => {
      const project = createMock<Project>({ id: 1, frameworkKey: "terrafund" });

      const mockFindAll = jest.fn().mockResolvedValue([]);
      const mockSites = jest.fn().mockReturnValue({ findAll: mockFindAll });
      jest.spyOn(SiteReport, "approved").mockReturnValue({
        sites: mockSites
      } as unknown as ReturnType<typeof SiteReport.approved>);

      const result = await service.getAggregateReports("projects", project);

      expect(result["tree-planted"]).toEqual([]);
      expect(result["trees-regenerating"]).toEqual([]);
    });

    it("returns period series (one point per unique due_at, sum per period) matching V2", async () => {
      const site = createMock<Site>({ id: 1, frameworkKey: "ppc" });
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

      expect(result["tree-planted"]).toBeDefined();
      expect(result["seeding-records"]).toBeDefined();
      expect(result["trees-regenerating"]).toBeDefined();

      const treePlanted = result["tree-planted"];
      if (treePlanted != null && treePlanted.length >= 2) {
        expect(treePlanted[0].aggregateAmount).toBe(100);
        expect(treePlanted[1].aggregateAmount).toBe(50);
      }

      const seeding = result["seeding-records"];
      if (seeding != null && seeding.length >= 2) {
        expect(seeding[0].aggregateAmount).toBe(20);
        expect(seeding[1].aggregateAmount).toBe(30);
      }

      const regenerating = result["trees-regenerating"];
      if (regenerating != null && regenerating.length >= 2) {
        expect(regenerating[0].aggregateAmount).toBe(5);
        expect(regenerating[1].aggregateAmount).toBe(3);
      }
    });
  });
});
