import { SitePolygon } from "@terramatch-microservices/database/entities";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import {
  IndicatorOutputHectaresFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { HectaresRestorationService } from "./hectares-restoration.service";

jest.mock("./dashboard-query.builder");

const baseMocks = () => {
  const mockBuilder = {
    queryFilters: jest.fn().mockReturnThis(),
    pluckIds: jest.fn().mockResolvedValue([1, 2]),
    execute: jest
      .fn()
      .mockResolvedValue([
        { organisation: { type: "non-profit-organization" } },
        { organisation: { type: "for-profit-organization" } }
      ]),
    sum: jest.fn().mockResolvedValue(100)
  };

  (DashboardProjectsQueryBuilder as unknown as jest.Mock).mockImplementation((model, page, include) => mockBuilder);

  return mockBuilder;
};

describe("HectaresRestorationService - filters", () => {
  let service: HectaresRestorationService;

  beforeEach(() => {
    service = new HectaresRestorationService();
    jest.clearAllMocks();
  });

  it("should apply filters with totals empty", async () => {
    const filters: DashboardQueryDto = {};

    const mockBuilder = baseMocks();

    const result = await service.getResults(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.restorationStrategiesRepresented).toBeDefined();
    expect(result.targetLandUseTypesRepresented).toBeDefined();
  });

  it("should apply filters with results", async () => {
    const filters: DashboardQueryDto = {};
    const hectaresByRestoration = "restorationByStrategy";
    const hectaresByTargetLandUseTypes = "restorationByLandUse";

    const mockBuilder = baseMocks();

    const site = await SiteFactory.create();
    const sitePolygon = await SitePolygonFactory.create({ site, isActive: true, status: "approved" });
    await IndicatorOutputHectaresFactory.create({
      sitePolygonId: sitePolygon.id,
      indicatorSlug: hectaresByRestoration,
      value: { "tree-planting": 100.0 }
    });
    await IndicatorOutputHectaresFactory.create({
      sitePolygonId: sitePolygon.id,
      indicatorSlug: hectaresByTargetLandUseTypes,
      value: { "natural-forest": 200.0 }
    });
    jest.spyOn(SitePolygon, "findAll").mockImplementation(() => Promise.resolve([sitePolygon]));

    const result = await service.getResults(filters);
    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.restorationStrategiesRepresented).toBeDefined();
    expect(result.restorationStrategiesRepresented).toHaveProperty("tree-planting");
    expect(result.restorationStrategiesRepresented["tree-planting"]).toBe(100.0);
    expect(result.targetLandUseTypesRepresented).toBeDefined();
    expect(result.targetLandUseTypesRepresented).toHaveProperty("natural-forest");
    expect(result.targetLandUseTypesRepresented["natural-forest"]).toBe(200.0);
  });
});
