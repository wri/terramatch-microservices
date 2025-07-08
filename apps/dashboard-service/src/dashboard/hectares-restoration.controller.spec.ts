import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "./dto/cache.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { HectaresRestorationController } from "./hectares-restoration.controller";
import { HectaresRestorationService } from "./hectares-restoration.service";

const getTotalsResult = () => {
  return {
    restorationStrategiesRepresented: {
      "tree-planting": 100.0,
      "direct-seeding": 211.0
    },
    targetLandUseTypesRepresented: {
      "natural-forest": 600.0,
      "riparian-area-or-wetland": 200.0
    }
  };
};

describe("HectaresRestorationController", () => {
  let controller: HectaresRestorationController;
  let cacheService: jest.Mocked<CacheService>;
  let hectaresRestorationService: DeepMocked<HectaresRestorationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HectaresRestorationController],
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
          provide: HectaresRestorationService,
          useValue: (hectaresRestorationService = createMock<HectaresRestorationService>())
        }
      ]
    }).compile();

    controller = module.get<HectaresRestorationController>(HectaresRestorationController);
    cacheService = module.get(CacheService);
  });

  it("should return HectareRestorationDto if there is no cached data", async () => {
    cacheService.get.mockResolvedValue(null);

    const query = {} as DashboardQueryDto;

    hectaresRestorationService.getResults.mockResolvedValue(getTotalsResult());

    const response = await controller.getHectaresRestoration(query);

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    if (response.data !== undefined && !Array.isArray(response.data)) {
      expect(response.data.type).toBe("hectareRestoration");
      expect(response.data.attributes).toBeDefined();
    } else {
      fail("response.data should not be an array");
    }
  });

  it("should return HectareRestorationDto if cached data exists", async () => {
    cacheService.get.mockResolvedValue(getTotalsResult());

    const query = {} as DashboardQueryDto;
    const response = await controller.getHectaresRestoration(query);

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    if (response.data !== undefined && !Array.isArray(response.data)) {
      expect(response.data.type).toBe("hectareRestoration");
      expect(response.data.attributes.restorationStrategiesRepresented).toBeDefined();
      expect(response.data.attributes.targetLandUseTypesRepresented).toBeDefined();
      expect(response.data.attributes.restorationStrategiesRepresented["tree-planting"]).toBe(100.0);
      expect(response.data.attributes.targetLandUseTypesRepresented["natural-forest"]).toBe(600.0);
    } else {
      fail("response.data should not be an array");
    }
  });
});
