import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "./dto/cache.service";
import { TotalJobsCreatedController } from "./total-jobs-created.controller";
import { TotalJobsCreatedService } from "./total-jobs-created.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { TotalJobsCreatedDto } from "./dto/total-jobs-created.dto";

jest.mock("@terramatch-microservices/common/util/json-api-builder", () => ({
  buildJsonApi: jest.fn().mockImplementation(() => ({
    addData: jest.fn().mockReturnThis(),
    serialize: jest.fn().mockReturnValue({
      data: {
        type: "totalJobsCreated",
        id: "test-id",
        attributes: {}
      },
      meta: { resourceType: "totalJobsCreated" }
    })
  })),
  getStableRequestQuery: jest.fn().mockImplementation(query => query)
}));

const getTotalsResult = (): TotalJobsCreatedDto => {
  return {
    totalJobsCreated: 100,
    totalFt: 50,
    totalPt: 60,
    totalMen: 40,
    totalWomen: 30,
    totalNonBinary: 15,
    totalYouth: 20,
    totalNonYouth: 25,
    totalFtMen: 30,
    totalFtWomen: 20,
    totalFtNonBinary: 8,
    totalFtYouth: 10,
    totalFtNonYouth: 20,
    totalPtMen: 35,
    totalPtWomen: 25,
    totalPtNonBinary: 7,
    totalPtYouth: 15,
    totalPtNonYouth: 25,
    totalOthersGender: 10,
    totalFtOthersGender: 5,
    totalPtOthersGender: 5,
    totalOthersAge: 10,
    totalFtOthersAge: 5,
    totalPtOthersAge: 5,
    totalVolunteers: 80,
    volunteerMen: 35,
    volunteerWomen: 30,
    volunteerNonBinary: 8,
    volunteerOthers: 7,
    volunteerYouth: 45,
    volunteerNonYouth: 30,
    volunteerAgeOthers: 5
  };
};

describe("TotalJobsCreatedController", () => {
  let controller: TotalJobsCreatedController;
  let cacheService: jest.Mocked<CacheService>;
  let totalJobsCreatedService: DeepMocked<TotalJobsCreatedService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TotalJobsCreatedController],
      providers: [
        {
          provide: CacheService,
          useValue: {
            getCacheKeyFromQuery: jest.fn().mockReturnValue("test-key"),
            get: jest.fn(),
            set: jest.fn()
          }
        },
        {
          provide: TotalJobsCreatedService,
          useValue: (totalJobsCreatedService = createMock<TotalJobsCreatedService>())
        }
      ]
    }).compile();

    controller = module.get<TotalJobsCreatedController>(TotalJobsCreatedController);
    cacheService = module.get(CacheService);
  });

  describe("getTotalJobsCreated", () => {
    it("should return TotalJobsCreatedDto when there is no cached data", async () => {
      cacheService.get.mockResolvedValue(null);
      const query: DashboardQueryDto = {};
      const expectedResult = getTotalsResult();
      totalJobsCreatedService.getTotals.mockResolvedValue(expectedResult);

      const response = await controller.getTotalJobsCreated(query);

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      if (response.data !== undefined && !Array.isArray(response.data)) {
        expect(response.data.type).toBe("totalJobsCreated");
        expect(response.data.attributes).toBeDefined();
      } else {
        fail("response.data should not be an array");
      }

      expect(cacheService.get).toHaveBeenCalledWith(`dashboard:jobs-created|test-key`, expect.any(Function));
    });

    it("should return cached TotalJobsCreatedDto when cached data exists", async () => {
      const cachedResult = getTotalsResult();
      cacheService.get.mockResolvedValue(cachedResult);
      const query: DashboardQueryDto = { country: "Kenya" };

      const response = await controller.getTotalJobsCreated(query);

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      if (response.data !== undefined && !Array.isArray(response.data)) {
        expect(response.data.type).toBe("totalJobsCreated");
        expect(response.data.attributes).toBeDefined();
      } else {
        fail("response.data should not be an array");
      }

      expect(totalJobsCreatedService.getTotals).not.toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalledWith(`dashboard:jobs-created|test-key`, expect.any(Function));
    });

    it("should generate correct cache key with query parameters", async () => {
      cacheService.get.mockResolvedValue(null);
      const query: DashboardQueryDto = {
        country: "Kenya",
        programmes: ["terrafund"],
        cohort: ["2023"],
        organisationType: ["non-profit-organization"]
      };
      const expectedResult = getTotalsResult();
      totalJobsCreatedService.getTotals.mockResolvedValue(expectedResult);
      cacheService.getCacheKeyFromQuery.mockReturnValue("terrafund||Kenya|non-profit-organization|2023|");

      await controller.getTotalJobsCreated(query);

      expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
      expect(cacheService.get).toHaveBeenCalledWith(
        `dashboard:jobs-created|terrafund||Kenya|non-profit-organization|2023|`,
        expect.any(Function)
      );
    });

    it("should handle empty query parameters", async () => {
      cacheService.get.mockResolvedValue(null);
      const query: DashboardQueryDto = {};
      const expectedResult = getTotalsResult();
      totalJobsCreatedService.getTotals.mockResolvedValue(expectedResult);

      const response = await controller.getTotalJobsCreated(query);

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      if (response.data !== undefined && !Array.isArray(response.data)) {
        expect(response.data.type).toBe("totalJobsCreated");
        expect(response.data.attributes).toBeDefined();
      } else {
        fail("response.data should not be an array");
      }

      expect(cacheService.getCacheKeyFromQuery).toHaveBeenCalledWith(query);
      expect(cacheService.get).toHaveBeenCalledWith(`dashboard:jobs-created|test-key`, expect.any(Function));
    });

    it("should create TotalJobsCreatedDto instance with correct data", async () => {
      cacheService.get.mockResolvedValue(null);
      const query: DashboardQueryDto = {};
      const expectedResult = getTotalsResult();
      totalJobsCreatedService.getTotals.mockResolvedValue(expectedResult);

      const response = await controller.getTotalJobsCreated(query);

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      if (response.data !== undefined && !Array.isArray(response.data)) {
        expect(response.data.type).toBe("totalJobsCreated");
        expect(response.data.attributes).toBeDefined();
      } else {
        fail("response.data should not be an array");
      }
    });
  });

  describe("controller initialization", () => {
    it("should be defined", () => {
      expect(controller).toBeDefined();
    });

    it("should have required dependencies injected", () => {
      expect(controller["cacheService"]).toBeDefined();
      expect(controller["jobsCreatedService"]).toBeDefined();
    });
  });
});
