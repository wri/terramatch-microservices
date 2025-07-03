import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "./dto/cache.service";
import { TotalJobsCreatedController } from "./total-jobs-created.controller";
import { TotalJobsCreatedService } from "./total-jobs-created.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

const getTotalsResult = () => {
  return {
    totalJobsCreated: 100,
    totalFt: 50,
    totalFtMen: 30,
    totalFtNonYouth: 20,
    totalFtWomen: 20,
    totalFtYouth: 10,
    totalMen: 40,
    totalNonYouth: 25,
    totalPt: 60,
    totalPtMen: 35,
    totalPtNonYouth: 25,
    totalPtWomen: 25,
    totalPtYouth: 15,
    totalWomen: 30,
    totalYouth: 20
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

  it("should return DelayedJobDto if there is no cached data", async () => {
    cacheService.get.mockResolvedValue(null);

    const query = {} as DashboardQueryDto;

    totalJobsCreatedService.getTotals.mockResolvedValue(getTotalsResult());

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

  it("should return TotalSectionHeaderDto if cached data exists", async () => {
    cacheService.get.mockResolvedValue(getTotalsResult());

    const query = {} as DashboardQueryDto;
    const response = await controller.getTotalJobsCreated(query);

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    if (response.data !== undefined && !Array.isArray(response.data)) {
      expect(response.data.type).toBe("totalJobsCreated");
      expect(response.data.attributes.totalJobsCreated).toBe(100);
      expect(response.data.attributes.totalMen).toBe(40);
      expect(response.data.attributes.totalYouth).toBe(20);
    } else {
      fail("response.data should not be an array");
    }
  });
});
