import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { CacheService } from "./dto/cache.service";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";

describe("DashboardEntitiesService", () => {
  let service: DashboardEntitiesService;
  let cacheService: DeepMocked<CacheService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardEntitiesService,
        {
          provide: CacheService,
          useValue: cacheService
        }
      ]
    }).compile();

    service = module.get<DashboardEntitiesService>(DashboardEntitiesService);
  });

  it("should create a dashboard processor for valid entity", () => {
    const processor = service.createDashboardProcessor("dashboardProjects");

    expect(processor).toBeDefined();
    expect(processor).toBeInstanceOf(DashboardProjectsProcessor);
  });

  it("should return the cache service", () => {
    const returnedCacheService = service.getCacheService();

    expect(returnedCacheService).toBe(cacheService);
  });
});
