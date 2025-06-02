import { TreeRestorationGoalService } from "./tree-restoration-goal.service";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import { Project, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dashboard-query.dto";
import { literal, Op } from "sequelize";

jest.mock("../dashboard-query.builder");
jest.mock("@terramatch-microservices/database/entities");

describe("TreeRestorationGoalService", () => {
  let service: TreeRestorationGoalService;
  let mockBuilder: jest.Mocked<DashboardProjectsQueryBuilder>;

  const mockProjects = [
    {
      id: 1,
      treesGrownGoal: 10000,
      organisation: { type: "non-profit-organization" }
    },
    {
      id: 2,
      treesGrownGoal: 15000,
      organisation: { type: "for-profit-organization" }
    },
    {
      id: 3,
      treesGrownGoal: null,
      organisation: { type: "non-profit-organization" }
    }
  ] as unknown as Project[];

  const mockSiteReports = [
    {
      id: 1,
      dueAt: new Date("2023-01-15T00:00:00.000Z"),
      treesPlanted: [{ amount: 1000 }, { amount: 2000 }]
    },
    {
      id: 2,
      dueAt: new Date("2023-07-20T00:00:00.000Z"),
      treesPlanted: [{ amount: 1500 }]
    },
    {
      id: 3,
      dueAt: new Date("2024-01-10T00:00:00.000Z"),
      treesPlanted: [{ amount: 2500 }]
    }
  ];

  const mockDistinctDates = [
    { year: 2023, month: 1 },
    { year: 2023, month: 7 },
    { year: 2024, month: 1 }
  ];

  beforeEach(() => {
    service = new TreeRestorationGoalService();

    mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      execute: jest.fn()
    } as unknown as jest.Mocked<DashboardProjectsQueryBuilder>;

    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

    // Mock Site methods
    (Site.approvedIdsProjectsSubquery as jest.Mock).mockResolvedValue("approved-sites-subquery");

    // Mock SiteReport methods
    (SiteReport.approvedIdsSubquery as jest.Mock).mockResolvedValue("approved-site-reports-subquery");
    (SiteReport.findAll as jest.Mock).mockResolvedValue(mockSiteReports);

    // Mock TreeSpecies methods
    (TreeSpecies.visible as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      siteReports: jest.fn().mockReturnThis(),
      sum: jest.fn().mockResolvedValue(5000)
    });

    jest.clearAllMocks();
  });

  describe("getTreeRestorationGoal", () => {
    it("should return complete tree restoration goal data", async () => {
      const query: DashboardQueryDto = {
        country: "BEN",
        programmes: ["terrafund"]
      };

      mockBuilder.execute.mockResolvedValue(mockProjects);

      const result = await service.getTreeRestorationGoal(query);

      expect(DashboardProjectsQueryBuilder).toHaveBeenCalledWith(Project, [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type"]
        }
      ]);
      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(query);
      expect(mockBuilder.execute).toHaveBeenCalled();

      expect(result).toHaveProperty("forProfitTreeCount");
      expect(result).toHaveProperty("nonProfitTreeCount");
      expect(result).toHaveProperty("totalTreesGrownGoal");
      expect(result).toHaveProperty("treesUnderRestorationActualTotal");
      expect(result).toHaveProperty("treesUnderRestorationActualForProfit");
      expect(result).toHaveProperty("treesUnderRestorationActualNonProfit");

      expect(result.totalTreesGrownGoal).toBe(25000); // 10000 + 15000 + 0
    });

    it("should handle empty projects list", async () => {
      const query: DashboardQueryDto = {};

      mockBuilder.execute.mockResolvedValue([]);
      (Site.approvedIdsProjectsSubquery as jest.Mock).mockResolvedValue(literal("(0)"));

      // Override TreeSpecies mock to return 0 for empty case
      (TreeSpecies.visible as jest.Mock).mockReturnValue({
        collection: jest.fn().mockReturnThis(),
        siteReports: jest.fn().mockReturnThis(),
        sum: jest.fn().mockResolvedValue(0)
      });

      // Override SiteReport.findAll to return empty array for empty projects case
      (SiteReport.findAll as jest.Mock).mockResolvedValue([]);

      const result = await service.getTreeRestorationGoal(query);

      expect(result.totalTreesGrownGoal).toBe(0);
      expect(result.forProfitTreeCount).toBe(0);
      expect(result.nonProfitTreeCount).toBe(0);
      expect(result.treesUnderRestorationActualTotal).toEqual([]);
      expect(result.treesUnderRestorationActualForProfit).toEqual([]);
      expect(result.treesUnderRestorationActualNonProfit).toEqual([]);
    });

    it("should filter projects by organisation type correctly", async () => {
      const query: DashboardQueryDto = {
        organisationType: ["non-profit-organization"]
      };

      mockBuilder.execute.mockResolvedValue(mockProjects);

      await service.getTreeRestorationGoal(query);

      // Check that Site.approvedIdsProjectsSubquery was called with correct project IDs
      expect(Site.approvedIdsProjectsSubquery).toHaveBeenCalledWith([1, 2, 3]); // all projects
      expect(Site.approvedIdsProjectsSubquery).toHaveBeenCalledWith([2]); // for-profit only (project 2)
      expect(Site.approvedIdsProjectsSubquery).toHaveBeenCalledWith([1, 3]); // non-profit only (projects 1, 3)
    });

    it("should handle projects with null treesGrownGoal", async () => {
      const query: DashboardQueryDto = {};
      const projectsWithNulls = [
        { id: 1, treesGrownGoal: null, organisation: { type: "non-profit-organization" } },
        { id: 2, treesGrownGoal: undefined, organisation: { type: "for-profit-organization" } },
        { id: 3, treesGrownGoal: 5000, organisation: { type: "non-profit-organization" } }
      ] as unknown as Project[];

      mockBuilder.execute.mockResolvedValue(projectsWithNulls);

      const result = await service.getTreeRestorationGoal(query);

      expect(result.totalTreesGrownGoal).toBe(5000); // Only the non-null value
    });

    it("should handle all filters combined", async () => {
      const query: DashboardQueryDto = {
        organisationType: ["for-profit-organization", "non-profit-organization"],
        country: "CMR",
        programmes: ["terrafund", "ppc"],
        projectUuid: "uuid-123",
        landscapes: ["landscape1"],
        cohort: "cohort-2024"
      };

      mockBuilder.execute.mockResolvedValue(mockProjects);

      await service.getTreeRestorationGoal(query);

      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(query);
    });
  });

  describe("getTreeCount (private method)", () => {
    it("should calculate tree count from approved site reports", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");

      // Call the private method through the public interface
      const result = await (service as unknown as { getTreeCount: (query: unknown) => Promise<number> }).getTreeCount(
        mockApprovedSitesQuery
      );

      expect(SiteReport.approvedIdsSubquery).toHaveBeenCalledWith(mockApprovedSitesQuery);
      expect(TreeSpecies.visible).toHaveBeenCalled();
      expect(result).toBe(5000);
    });

    it("should return 0 when no tree species data", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");

      (TreeSpecies.visible as jest.Mock).mockReturnValue({
        collection: jest.fn().mockReturnThis(),
        siteReports: jest.fn().mockReturnThis(),
        sum: jest.fn().mockResolvedValue(null)
      });

      const result = await (service as unknown as { getTreeCount: (query: unknown) => Promise<number> }).getTreeCount(
        mockApprovedSitesQuery
      );

      expect(result).toBe(0);
    });
  });

  describe("getDistinctDates (private method)", () => {
    it("should return distinct year/month combinations from site reports", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");

      (SiteReport.findAll as jest.Mock).mockResolvedValue([
        { year: 2023, month: 1 },
        { year: 2023, month: 7 },
        { year: 2024, month: 1 }
      ]);

      const result = await (
        service as unknown as { getDistinctDates: (query: unknown) => Promise<unknown[]> }
      ).getDistinctDates(mockApprovedSitesQuery);

      expect(SiteReport.approvedIdsSubquery).toHaveBeenCalledWith(mockApprovedSitesQuery);
      expect(SiteReport.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { [Op.in]: "approved-site-reports-subquery" }
          },
          raw: true
        })
      );

      expect(result).toEqual([
        { year: 2023, month: 1 },
        { year: 2023, month: 7 },
        { year: 2024, month: 1 }
      ]);
    });

    it("should handle empty site reports", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");

      (SiteReport.findAll as jest.Mock).mockResolvedValue([]);

      const result = await (
        service as unknown as { getDistinctDates: (query: unknown) => Promise<unknown[]> }
      ).getDistinctDates(mockApprovedSitesQuery);

      expect(result).toEqual([]);
    });

    it("should handle null site reports", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");

      (SiteReport.findAll as jest.Mock).mockResolvedValue(null);

      const result = await (
        service as unknown as { getDistinctDates: (query: unknown) => Promise<unknown[]> }
      ).getDistinctDates(mockApprovedSitesQuery);

      expect(result).toEqual([]);
    });
  });

  describe("calculateTreesUnderRestoration (private method)", () => {
    it("should calculate trees under restoration for given dates", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 50000;

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, mockDistinctDates, totalTreesGrownGoal);

      expect(SiteReport.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { [Op.in]: "approved-site-reports-subquery" }
          },
          include: [
            {
              model: TreeSpecies,
              as: "treesPlanted",
              required: false,
              where: {
                hidden: false,
                collection: "tree-planted"
              }
            }
          ]
        })
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("dueDate");
      expect(result[0]).toHaveProperty("treeSpeciesAmount");
      expect(result[0]).toHaveProperty("treeSpeciesPercentage");
    });

    it("should return empty array when no distinct dates", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 50000;

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, [], totalTreesGrownGoal);

      expect(result).toEqual([]);
    });

    it("should handle site reports with null dueAt", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 50000;

      const siteReportsWithNullDates = [
        {
          id: 1,
          dueAt: null,
          treesPlanted: [{ amount: 1000 }]
        },
        {
          id: 2,
          dueAt: new Date("2023-01-15T00:00:00.000Z"),
          treesPlanted: [{ amount: 2000 }]
        }
      ];

      (SiteReport.findAll as jest.Mock).mockResolvedValue(siteReportsWithNullDates);

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, mockDistinctDates, totalTreesGrownGoal);

      // Should only process reports with valid dueAt dates
      expect(result).toHaveLength(3);
    });

    it("should calculate percentage correctly with zero goal", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 0;

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, mockDistinctDates, totalTreesGrownGoal);

      expect(result).toHaveLength(3);
      result.forEach((item: unknown) => {
        expect((item as { treeSpeciesPercentage: number }).treeSpeciesPercentage).toBe(0);
      });
    });

    it("should handle reports with null tree species amounts", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 50000;

      const siteReportsWithNullAmounts = [
        {
          id: 1,
          dueAt: new Date("2023-01-15T00:00:00.000Z"),
          treesPlanted: [{ amount: null }, { amount: 1000 }]
        }
      ];

      (SiteReport.findAll as jest.Mock).mockResolvedValue(siteReportsWithNullAmounts);

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, mockDistinctDates, totalTreesGrownGoal);

      expect(result).toHaveLength(3);
      // Should handle null amounts gracefully
      expect(result[0]).toHaveProperty("treeSpeciesAmount");
    });

    it("should handle reports with null treesPlanted", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 50000;

      const siteReportsWithNullTreesPlanted = [
        {
          id: 1,
          dueAt: new Date("2023-01-15T00:00:00.000Z"),
          treesPlanted: null
        }
      ];

      (SiteReport.findAll as jest.Mock).mockResolvedValue(siteReportsWithNullTreesPlanted);

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, mockDistinctDates, totalTreesGrownGoal);

      expect(result).toHaveLength(3);
      // Should handle null treesPlanted gracefully
      expect(result[0]).toHaveProperty("treeSpeciesAmount");
    });

    it("should format date correctly", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 50000;

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, mockDistinctDates, totalTreesGrownGoal);

      expect(result[0]).toHaveProperty("dueDate");
      expect((result[0] as { dueDate: Date }).dueDate).toBeInstanceOf(Date);
      expect((result[0] as { dueDate: Date }).dueDate.getTime()).not.toBeNaN();

      // Check specific date formatting
      const firstResult = result[0] as { dueDate: Date };
      expect(firstResult.dueDate.getFullYear()).toBe(2023);
      expect(firstResult.dueDate.getMonth()).toBe(0); // January is 0
      expect(firstResult.dueDate.getDate()).toBe(1);
    });

    it("should round percentage to 3 decimal places", async () => {
      const mockApprovedSitesQuery = literal("approved-sites");
      const totalTreesGrownGoal = 333; // Will create repeating decimals

      const siteReportsForRounding = [
        {
          id: 1,
          dueAt: new Date("2023-01-15T00:00:00.000Z"),
          treesPlanted: [{ amount: 100 }] // 100/333 = 30.030030...%
        }
      ];

      (SiteReport.findAll as jest.Mock).mockResolvedValue(siteReportsForRounding);

      const result = await (
        service as unknown as {
          calculateTreesUnderRestoration: (
            query: unknown,
            dates: { year: number; month: number }[],
            goal: number
          ) => Promise<unknown[]>;
        }
      ).calculateTreesUnderRestoration(mockApprovedSitesQuery, [{ year: 2023, month: 1 }], totalTreesGrownGoal);

      expect(result).toHaveLength(1);
      const percentage = (result[0] as { treeSpeciesPercentage: number }).treeSpeciesPercentage;
      expect(percentage).toBe(30.03); // Should be rounded to 3 decimal places
      expect(percentage.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
    });
  });
});
