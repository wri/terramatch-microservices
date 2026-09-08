import { Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { HectaresRestorationService } from "./hectares-restoration.service";

jest.mock("./dashboard-query.builder");

const baseMocks = (projectIds: number[] = [1, 2]) => {
  const mockBuilder = {
    queryFilters: jest.fn().mockReturnThis(),
    pluckIds: jest.fn().mockResolvedValue(projectIds),
    execute: jest
      .fn()
      .mockResolvedValue([
        { organisation: { type: "non-profit-organization" } },
        { organisation: { type: "for-profit-organization" } }
      ]),
    sum: jest.fn().mockResolvedValue(100)
  };

  (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

  return mockBuilder;
};

const mockPolygonQuery = (polygons: Array<Partial<SitePolygon>>) => {
  const findAll = jest.fn().mockResolvedValue(polygons);
  jest.spyOn(SitePolygon, "active").mockReturnValue({
    approved: jest.fn().mockReturnThis(),
    sites: jest.fn().mockReturnThis(),
    findAll
  } as unknown as typeof SitePolygon);
  jest.spyOn(Site, "approvedUuidsProjectsSubquery").mockReturnValue("site-subquery" as never);
  return findAll;
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
    mockPolygonQuery([]);

    const result = await service.getResults(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.restorationStrategiesRepresented).toEqual({});
    expect(result.targetLandUseTypesRepresented).toEqual({});
  });

  it("should skip the polygon query when no projects match", async () => {
    baseMocks([]);
    const findAll = mockPolygonQuery([]);

    const result = await service.getResults({});

    expect(findAll).not.toHaveBeenCalled();
    expect(Site.approvedUuidsProjectsSubquery).not.toHaveBeenCalled();
    expect(result.restorationStrategiesRepresented).toEqual({});
    expect(result.targetLandUseTypesRepresented).toEqual({});
  });

  it("should group calcArea by practice and target land use", async () => {
    const filters: DashboardQueryDto = {};
    const mockBuilder = baseMocks();
    mockPolygonQuery([
      { practice: ["tree-planting"], targetSys: "natural-forest", calcArea: 100 },
      { practice: ["tree-planting"], targetSys: "natural-forest", calcArea: 50.555 },
      { practice: ["direct-seeding"], targetSys: "riparian-area-or-wetland", calcArea: 25 }
    ]);

    const result = await service.getResults(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.restorationStrategiesRepresented).toEqual({
      "tree-planting": 150.555,
      "direct-seeding": 25
    });
    expect(result.targetLandUseTypesRepresented).toEqual({
      "natural-forest": 150.555,
      "riparian-area-or-wetland": 25
    });
  });

  it("should keep multiple strategies as one key and empty attributes as an empty key", async () => {
    baseMocks();
    mockPolygonQuery([
      { practice: ["tree-planting", "direct-seeding"], targetSys: "agroforest", calcArea: 10 },
      { practice: [], targetSys: "", calcArea: 7 },
      { practice: null, targetSys: null, calcArea: 3 },
      { practice: ["tree-planting"], targetSys: "natural-forest", calcArea: null }
    ]);

    const result = await service.getResults({});

    expect(result.restorationStrategiesRepresented).toEqual({
      "tree-planting,direct-seeding": 10,
      "": 10
    });
    expect(result.targetLandUseTypesRepresented).toEqual({
      agroforest: 10,
      "": 10
    });
  });
});
