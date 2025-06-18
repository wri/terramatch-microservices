import { Test, TestingModule } from "@nestjs/testing";
import { TreeRestorationGoalController } from "./tree-restoration-goal.controller";
import { TreeRestorationGoalService } from "./dto/tree-restoration-goal.service";
import { CacheService } from "./dto/cache.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

// Mock the json-api-builder module
jest.mock("@terramatch-microservices/common/util/json-api-builder", () => ({
  buildJsonApi: jest.fn().mockImplementation(() => ({
    addData: jest.fn(),
    serialize: jest.fn().mockReturnValue({ mockSerialized: true })
  })),
  getStableRequestQuery: jest.fn().mockImplementation(query => query)
}));

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

      const mockTimestamp = "2024-01-01T00:00:00.000Z";
      const mockDate = new Date(mockTimestamp);

      cacheService.getCacheKeyFromQuery.mockReturnValue("test-cache-key");

      // Mock cache.get for timestamp key (cache miss, executes callback)
      cacheService.get
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => {
          expect(key).toBe("dashboard:tree-restoration-goal|test-cache-key:timestamp");
          return factory?.();
        })
        // Mock cache.get for data key (cache miss, executes callback)
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => {
          expect(key).toBe("dashboard:tree-restoration-goal|test-cache-key");
          return factory?.();
        });

      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);

      // Mock Date constructor to return consistent timestamp
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const result = await controller.getTreeRestorationGoal(query);

      expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
      expect(treeRestorationGoalService.getTreeRestorationGoal).toHaveBeenCalledWith(query);
      expect(cacheService.set).toHaveBeenCalledWith(
        "dashboard:tree-restoration-goal|test-cache-key:timestamp",
        mockTimestamp
      );
      expect(result).toEqual({ mockSerialized: true });

      jest.restoreAllMocks();
    });

    it("should return cached data when cache exists", async () => {
      const query: DashboardQueryDto = {
        organisationType: ["non-profit-organization"]
      };

      const mockTimestamp = "2024-01-01T00:00:00.000Z";

      cacheService.getCacheKeyFromQuery.mockReturnValue("cached-key");

      // Mock cache.get for timestamp key (cache hit)
      cacheService.get
        .mockResolvedValueOnce(mockTimestamp)
        // Mock cache.get for data key (cache hit)
        .mockResolvedValueOnce(mockCachedData);

      const result = await controller.getTreeRestorationGoal(query);

      expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
      expect(cacheService.get).toHaveBeenCalledWith(
        "dashboard:tree-restoration-goal|cached-key:timestamp",
        expect.any(Function)
      );
      expect(cacheService.get).toHaveBeenCalledWith("dashboard:tree-restoration-goal|cached-key", expect.any(Function));
      expect(treeRestorationGoalService.getTreeRestorationGoal).not.toHaveBeenCalled();
      expect(result).toEqual({ mockSerialized: true });
    });

    it("should handle empty query object", async () => {
      const query: DashboardQueryDto = {};
      const mockTimestamp = "2024-01-01T00:00:00.000Z";
      const mockDate = new Date(mockTimestamp);

      cacheService.getCacheKeyFromQuery.mockReturnValue("empty-query-key");

      // Mock cache misses for both keys
      cacheService.get
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.())
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.());

      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const result = await controller.getTreeRestorationGoal(query);

      expect(treeRestorationGoalService.getTreeRestorationGoal).toHaveBeenCalledWith(query);
      expect(result).toEqual({ mockSerialized: true });

      jest.restoreAllMocks();
    });

    it("should handle query with all possible filters", async () => {
      const query: DashboardQueryDto = {
        organisationType: ["for-profit-organization", "non-profit-organization"],
        country: "CMR",
        programmes: ["terrafund", "ppc"],
        projectUuid: "uuid-123",
        landscapes: ["gcb", "grv"],
        cohort: "cohort-2024"
      };

      const mockTimestamp = "2024-01-01T00:00:00.000Z";
      const mockDate = new Date(mockTimestamp);

      cacheService.getCacheKeyFromQuery.mockReturnValue("full-query-key");

      // Mock cache misses
      cacheService.get
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.())
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.());

      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const result = await controller.getTreeRestorationGoal(query);

      expect(treeRestorationGoalService.getTreeRestorationGoal).toHaveBeenCalledWith(query);
      expect(result).toEqual({ mockSerialized: true });

      jest.restoreAllMocks();
    });

    it("should handle empty arrays in restoration data when no cache", async () => {
      const query: DashboardQueryDto = { cohort: "empty-cohort" };
      const mockTimestamp = "2024-01-01T00:00:00.000Z";
      const mockDate = new Date(mockTimestamp);

      const emptyServiceResponse = {
        ...mockServiceResponse,
        treesUnderRestorationActualTotal: [],
        treesUnderRestorationActualForProfit: [],
        treesUnderRestorationActualNonProfit: []
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("empty-arrays-key");

      // Mock cache misses
      cacheService.get
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.())
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.());

      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(emptyServiceResponse);
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toEqual({ mockSerialized: true });

      jest.restoreAllMocks();
    });

    it("should handle zero values correctly when no cache", async () => {
      const query: DashboardQueryDto = { projectUuid: "zero-project" };
      const mockTimestamp = "2024-01-01T00:00:00.000Z";

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

      // Mock cache misses
      cacheService.get
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.())
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.());

      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(zeroServiceResponse);
      const mockDate = new Date(mockTimestamp);
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toEqual({ mockSerialized: true });

      jest.restoreAllMocks();
    });

    it("should handle cached data with empty arrays", async () => {
      const query: DashboardQueryDto = { cohort: "empty-cached-cohort" };
      const mockTimestamp = "2024-01-01T00:00:00.000Z";

      const emptyCachedData = {
        ...mockCachedData,
        treesUnderRestorationActualTotal: [],
        treesUnderRestorationActualForProfit: [],
        treesUnderRestorationActualNonProfit: []
      };

      cacheService.getCacheKeyFromQuery.mockReturnValue("empty-cached-arrays-key");

      // Mock cache hits
      cacheService.get.mockResolvedValueOnce(mockTimestamp).mockResolvedValueOnce(emptyCachedData);

      const result = await controller.getTreeRestorationGoal(query);

      expect(result).toEqual({ mockSerialized: true });
    });

    it("should set timestamp when data is fetched from service", async () => {
      const query: DashboardQueryDto = { landscapes: ["ikr"] };
      const mockTimestamp = "2024-12-01T12:00:00.000Z";

      cacheService.getCacheKeyFromQuery.mockReturnValue("timestamp-test-key");

      // Mock cache misses
      cacheService.get
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.())
        .mockImplementationOnce(async (key: string, factory?: () => Promise<string | object>) => factory?.());

      treeRestorationGoalService.getTreeRestorationGoal.mockResolvedValue(mockServiceResponse);
      const mockDate = new Date(mockTimestamp);
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      await controller.getTreeRestorationGoal(query);

      expect(cacheService.set).toHaveBeenCalledWith(
        "dashboard:tree-restoration-goal|timestamp-test-key:timestamp",
        mockTimestamp
      );

      jest.restoreAllMocks();
    });

    it("should handle cache service errors gracefully", async () => {
      const query: DashboardQueryDto = { country: "ERROR" };

      cacheService.getCacheKeyFromQuery.mockReturnValue("error-key");
      cacheService.get.mockRejectedValue(new Error("Cache error"));

      await expect(controller.getTreeRestorationGoal(query)).rejects.toThrow("Cache error");
    });
  });
});
