import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardEntitiesService } from "./dashboard-entities.service";
import { CacheService } from "./dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";

describe("DashboardEntitiesService", () => {
  let service: DashboardEntitiesService;
  let cacheService: DeepMocked<CacheService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();
    policyService = createMock<PolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DashboardEntitiesService,
          useFactory: () => new DashboardEntitiesService(cacheService, policyService)
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
