import { Test, TestingModule } from "@nestjs/testing";
import { TotalSectionHeaderController } from "./total-section-header.controller";
import { CacheService } from "./dto/cache.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

jest.mock("@terramatch-microservices/database/entities", () => ({
  DelayedJob: {
    create: jest.fn().mockResolvedValue({
      id: 1,
      uuid: "fake-uuid"
    })
  }
}));

describe("TotalSectionHeaderController", () => {
  let controller: TotalSectionHeaderController;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TotalSectionHeaderController],
      providers: [
        {
          provide: CacheService,
          useValue: {
            getCacheKeyFromQuery: jest.fn().mockReturnValue("test-key"),
            getTimestampForTotalSectionHeader: jest.fn().mockResolvedValue("2024-01-01T00:00:00.000Z"),
            get: jest.fn(),
            getTotalSectionHeader: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<TotalSectionHeaderController>(TotalSectionHeaderController);
    cacheService = module.get(CacheService);
  });

  it("should return DelayedJobDto if there is no cached data", async () => {
    cacheService.get.mockResolvedValue(null);

    const query = {} as DashboardQueryDto;
    const response = await controller.getTotalSectionHeader(query);

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    if (response.data && !Array.isArray(response.data)) {
      expect(response.data.type).toBe("delayedJobs");
      expect(response.data.id).toBe("fake-uuid");
      expect(response.data.attributes.uuid).toBe("fake-uuid");
    } else {
      fail("response.data should not be an array");
    }
  });

  it("should return TotalSectionHeaderDto if cached data exists", async () => {
    cacheService.get.mockResolvedValue({
      totalNonProfitCount: 5,
      totalEnterpriseCount: 3,
      totalEntries: 8,
      totalHectaresRestored: 100,
      totalHectaresRestoredGoal: 200,
      totalTreesRestored: 1000,
      totalTreesRestoredGoal: 2000
    });
    cacheService.getTimestampForTotalSectionHeader.mockResolvedValue("2025-01-01T00:00:00.000Z");

    const query = {} as DashboardQueryDto;
    const response = await controller.getTotalSectionHeader(query);

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    if (response.data && !Array.isArray(response.data)) {
      expect(response.data.type).toBe("totalSectionHeaders");
      expect(response.data.attributes.totalNonProfitCount).toBe(5);
    } else {
      fail("response.data should not be an array");
    }
  });
});
