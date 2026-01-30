import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "./dto/cache.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardFrameworksController } from "./dashboard-frameworks.controller";
import { DashboardFrameworksService } from "./dashboard-frameworks.service";

const getFrameworksResult = () => [
  { framework_slug: "terrafund", name: "Terrafund" },
  { framework_slug: "terrafund-landscapes", name: "Terrafund Landscapes" }
];

describe("DashboardFrameworksController", () => {
  let controller: DashboardFrameworksController;
  let cacheService: jest.Mocked<CacheService>;
  let dashboardFrameworksService: DeepMocked<DashboardFrameworksService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardFrameworksController],
      providers: [
        {
          provide: CacheService,
          useValue: {
            getCacheKeyFromQuery: jest.fn().mockReturnValue("test-key"),
            get: jest.fn()
          }
        },
        {
          provide: DashboardFrameworksService,
          useValue: (dashboardFrameworksService = createMock<DashboardFrameworksService>())
        }
      ]
    }).compile();

    controller = module.get<DashboardFrameworksController>(DashboardFrameworksController);
    cacheService = module.get(CacheService);
  });

  it("should return frameworks array when no cached data", async () => {
    cacheService.get.mockImplementation((key, factory) => (factory != null ? factory() : Promise.resolve(null)));

    const query = {} as DashboardQueryDto;
    dashboardFrameworksService.getFrameworks.mockResolvedValue(getFrameworksResult());

    const result = await controller.getFrameworks(query);

    expect(result).toEqual(getFrameworksResult());
    expect(dashboardFrameworksService.getFrameworks).toHaveBeenCalledWith(query);
  });

  it("should return cached frameworks when cache hit", async () => {
    const cached = getFrameworksResult();
    cacheService.get.mockResolvedValue(cached);

    const query = { country: "Kenya" } as DashboardQueryDto;
    const result = await controller.getFrameworks(query);

    expect(result).toEqual(cached);
    expect(dashboardFrameworksService.getFrameworks).not.toHaveBeenCalled();
  });
});
