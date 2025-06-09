import { Test, TestingModule } from "@nestjs/testing";
import { TreeRestorationGoalController } from "./tree-restoration-goal.controller";
import { TreeRestorationGoalService } from "./dto/tree-restoration-goal.service";
import { CacheService } from "./dto/cache.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

describe("TreeRestorationGoalController", () => {
  let controller: TreeRestorationGoalController;
  let treeRestorationGoalService: jest.Mocked<TreeRestorationGoalService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockServiceResponse = {
    forProfitTreeCount: 1961902,
    nonProfitTreeCount: 23027107,
    totalTreesGrownGoal: 40532875,
    treesUnderRestorationActualTotal: [
      {
        dueDate: new Date("2022-09-01T04:00:00.000Z"),
        treeSpeciesAmount: 3859827,
        treeSpeciesGoal: 40532875
      },
      {
        dueDate: new Date("2023-01-01T04:00:00.000Z"),
        treeSpeciesAmount: 2849029,
        treeSpeciesGoal: 40532875
      }
    ],
    treesUnderRestorationActualForProfit: [
      {
        dueDate: new Date("2022-09-01T04:00:00.000Z"),
        treeSpeciesAmount: 557880,
        treeSpeciesGoal: 40532875
      }
    ],
    treesUnderRestorationActualNonProfit: [
      {
        dueDate: new Date("2022-09-01T04:00:00.000Z"),
        treeSpeciesAmount: 3301947,
        treeSpeciesGoal: 40532875
      }
    ]
  };

  const mockCachedData = {
    forProfitTreeCount: 1500000,
    nonProfitTreeCount: 20000000,
    totalTreesGrownGoal: 35000000,
    treesUnderRestorationActualTotal: [
      {
        dueDate: new Date("2023-01-01T04:00:00.000Z"),
        treeSpeciesAmount: 2500000,
        treeSpeciesGoal: 35000000
      }
    ],
    treesUnderRestorationActualForProfit: [
      {
        dueDate: new Date("2023-01-01T04:00:00.000Z"),
        treeSpeciesAmount: 500000,
        treeSpeciesGoal: 35000000
      }
    ],
    treesUnderRestorationActualNonProfit: [
      {
        dueDate: new Date("2023-01-01T04:00:00.000Z"),
        treeSpeciesAmount: 2000000,
        treeSpeciesGoal: 35000000
      }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TreeRestorationGoalController],
      providers: [
        {
          provide: TreeRestorationGoalService,
          useValue: {
            getTreeRestorationGoal: jest.fn()
          }
        },
        {
          provide: CacheService,
          useValue: {
            getCacheKeyFromQuery: jest.fn(),
            get: jest.fn(),
            set: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<TreeRestorationGoalController>(TreeRestorationGoalController);
    treeRestorationGoalService = module.get(TreeRestorationGoalService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getTreeRestorationGoal", () => {
    it("should return service result when cache is empty", async () => {
      const query: DashboardQueryDto = {
        country: "BEN",
        programmes: ["terrafund"]
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("test-cache-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);
      cacheService.set.mockResolvedValue(undefined);

      const result = await controller.getTreeRestorationGoal(query);

      expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
      expect(cacheService.get).toHaveBeenCalledWith("dashboard:tree-restoration-goal|test-cache-key:timestamp");
      expect(cacheService.get).toHaveBeenCalledWith("dashboard:tree-restoration-goal|test-cache-key");
      expect(treeRestorationGoalService.getTreeRestorationGoal).toHaveBeenCalledWith(query);
      expect(cacheService.set).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockServiceResponse);
    });

    it("should return cached data when cache exists", async () => {
      const query: DashboardQueryDto = {
        organisationType: ["non-profit-organization"]
      };

      const lastUpdatedAt = "2024-01-01T00:00:00.000Z";

      cacheService.getCacheKeyFromQuery.mockReturnValue("cached-key");
      cacheService.get.mockResolvedValueOnce(lastUpdatedAt).mockResolvedValueOnce(mockCachedData);

      const result = await controller.getTreeRestorationGoal(query);

      expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
      expect(cacheService.get).toHaveBeenCalledWith("dashboard:tree-restoration-goal|cached-key:timestamp");
      expect(cacheService.get).toHaveBeenCalledWith("dashboard:tree-restoration-goal|cached-key");
      expect(treeRestorationGoalService.getTreeRestorationGoal).not.toHaveBeenCalled();

      expect(result).toBeDefined();
      if (result !== undefined && !Array.isArray(result) && "data" in result) {
        const jsonApiResult = result as unknown as {
          data: {
            attributes: {
              lastUpdatedAt: string | null;
              forProfitTreeCount: number;
              nonProfitTreeCount: number;
            };
          };
        };
        expect(jsonApiResult.data.attributes.lastUpdatedAt).toBe(lastUpdatedAt);
        expect(jsonApiResult.data.attributes.forProfitTreeCount).toBe(mockCachedData.forProfitTreeCount);
        expect(jsonApiResult.data.attributes.nonProfitTreeCount).toBe(mockCachedData.nonProfitTreeCount);
      } else {
        fail("Expected JSON API response structure with data property");
      }
    });

    it("should handle empty query object", async () => {
      const query: DashboardQueryDto = {};

      cacheService.getCacheKeyFromQuery.mockReturnValue("empty-query-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);

      const result = await controller.getTreeRestorationGoal(query);

      expect(treeRestorationGoalService.getTreeRestorationGoal).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockServiceResponse);
    });

    it("should handle query with all possible filters", async () => {
      const query: DashboardQueryDto = {
        organisationType: ["for-profit-organization", "non-profit-organization"],
        country: "CMR",
        programmes: ["terrafund", "ppc"],
        projectUuid: "uuid-123",
        landscapes: ["landscape1", "landscape2"],
        cohort: "cohort-2024"
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("full-query-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);

      const result = await controller.getTreeRestorationGoal(query);

      expect(treeRestorationGoalService.getTreeRestorationGoal).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockServiceResponse);
    });

    it("should handle cached data with null timestamp", async () => {
      const query: DashboardQueryDto = { country: "KEN" };

      cacheService.getCacheKeyFromQuery.mockReturnValue("null-timestamp-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(mockCachedData);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toBeDefined();
      if (result !== undefined && !Array.isArray(result) && "data" in result) {
        const jsonApiResult = result as unknown as {
          data: {
            attributes: {
              lastUpdatedAt: string | null;
              forProfitTreeCount: number;
            };
          };
        };
        expect(jsonApiResult.data.attributes.lastUpdatedAt).toBeNull();
        expect(jsonApiResult.data.attributes.forProfitTreeCount).toBe(mockCachedData.forProfitTreeCount);
      } else {
        fail("Expected JSON API response structure with data property");
      }
    });

    it("should preserve Date objects in cached response", async () => {
      const query: DashboardQueryDto = { programmes: ["ppc"] };

      cacheService.getCacheKeyFromQuery.mockReturnValue("date-preservation-key");
      cacheService.get.mockResolvedValueOnce("2024-06-01T00:00:00.000Z").mockResolvedValueOnce(mockCachedData);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toBeDefined();
      if (result !== undefined && !Array.isArray(result) && "data" in result) {
        const jsonApiResult = result as unknown as {
          data: {
            attributes: {
              treesUnderRestorationActualTotal: Array<{
                dueDate: Date;
                treeSpeciesAmount: number;
                treeSpeciesGoal: number;
              }>;
            };
          };
        };
        expect(jsonApiResult.data.attributes.treesUnderRestorationActualTotal).toHaveLength(1);
        expect(jsonApiResult.data.attributes.treesUnderRestorationActualTotal[0].dueDate).toBeInstanceOf(Date);
        expect(jsonApiResult.data.attributes.treesUnderRestorationActualTotal[0].dueDate.getTime()).not.toBeNaN();
      } else {
        fail("Expected JSON API response structure with data property");
      }
    });

    it("should cache service result with proper timestamp", async () => {
      const query: DashboardQueryDto = { landscapes: ["test-landscape"] };
      const mockDate = new Date("2024-12-01T12:00:00.000Z");
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      cacheService.getCacheKeyFromQuery.mockReturnValue("timestamp-test-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);

      await controller.getTreeRestorationGoal(query);

      expect(cacheService.set).toHaveBeenCalledWith(
        "dashboard:tree-restoration-goal|timestamp-test-key",
        JSON.stringify(mockServiceResponse)
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        "dashboard:tree-restoration-goal|timestamp-test-key:timestamp",
        mockDate.toISOString()
      );

      jest.restoreAllMocks();
    });

    it("should handle empty arrays in restoration data when no cache", async () => {
      const query: DashboardQueryDto = { cohort: "empty-cohort" };
      const emptyServiceResponse = {
        ...mockServiceResponse,
        treesUnderRestorationActualTotal: [],
        treesUnderRestorationActualForProfit: [],
        treesUnderRestorationActualNonProfit: []
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("empty-arrays-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(emptyServiceResponse);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toEqual(emptyServiceResponse);
      expect((result as typeof emptyServiceResponse).treesUnderRestorationActualTotal).toEqual([]);
      expect((result as typeof emptyServiceResponse).treesUnderRestorationActualForProfit).toEqual([]);
      expect((result as typeof emptyServiceResponse).treesUnderRestorationActualNonProfit).toEqual([]);
    });

    it("should handle zero values correctly when no cache", async () => {
      const query: DashboardQueryDto = { projectUuid: "zero-project" };
      const zeroServiceResponse = {
        forProfitTreeCount: 0,
        nonProfitTreeCount: 0,
        totalTreesGrownGoal: 0,
        treesUnderRestorationActualTotal: [
          {
            dueDate: new Date("2024-01-01T00:00:00.000Z"),
            treeSpeciesAmount: 0,
            treeSpeciesGoal: 0
          }
        ],
        treesUnderRestorationActualForProfit: [],
        treesUnderRestorationActualNonProfit: []
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("zero-values-key");
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(zeroServiceResponse);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toEqual(zeroServiceResponse);
      expect((result as typeof zeroServiceResponse).forProfitTreeCount).toBe(0);
      expect((result as typeof zeroServiceResponse).nonProfitTreeCount).toBe(0);
      expect((result as typeof zeroServiceResponse).totalTreesGrownGoal).toBe(0);
      expect((result as typeof zeroServiceResponse).treesUnderRestorationActualTotal[0].treeSpeciesAmount).toBe(0);
      expect((result as typeof zeroServiceResponse).treesUnderRestorationActualTotal[0].treeSpeciesGoal).toBe(0);
    });

    it("should handle cached data with empty arrays", async () => {
      const query: DashboardQueryDto = { cohort: "empty-cached-cohort" };
      const emptyCachedData = {
        ...mockCachedData,
        treesUnderRestorationActualTotal: [],
        treesUnderRestorationActualForProfit: [],
        treesUnderRestorationActualNonProfit: []
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("empty-cached-arrays-key");
      cacheService.get.mockResolvedValueOnce("2024-01-01T00:00:00.000Z").mockResolvedValueOnce(emptyCachedData);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toBeDefined();
      if (result !== undefined && !Array.isArray(result) && "data" in result) {
        const jsonApiResult = result as unknown as {
          data: {
            attributes: {
              treesUnderRestorationActualTotal: unknown[];
              treesUnderRestorationActualForProfit: unknown[];
              treesUnderRestorationActualNonProfit: unknown[];
            };
          };
        };
        expect(jsonApiResult.data.attributes.treesUnderRestorationActualTotal).toEqual([]);
        expect(jsonApiResult.data.attributes.treesUnderRestorationActualForProfit).toEqual([]);
        expect(jsonApiResult.data.attributes.treesUnderRestorationActualNonProfit).toEqual([]);
      } else {
        fail("Expected JSON API response structure with data property");
      }
    });
  });
});
