import { Test, TestingModule } from "@nestjs/testing";
import { TreeCoverLossFiresCalculator } from "./tree-cover-loss-fires.calculator";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { SitePolygon } from "@terramatch-microservices/database/entities";

describe("TreeCoverLossFiresCalculator", () => {
  let calculator: TreeCoverLossFiresCalculator;
  const dataApiServiceMock = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([
      {
        umd_tree_cover_loss_from_fires__year: 25,
        area__ha: 100
      }
    ])
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreeCoverLossFiresCalculator,
        {
          provide: DataApiService,
          useValue: dataApiServiceMock
        }
      ]
    }).compile();

    calculator = module.get<TreeCoverLossFiresCalculator>(TreeCoverLossFiresCalculator);
  });

  it("should be defined", () => {
    expect(calculator).toBeDefined();
  });

  it("should calculate the tree cover loss fires", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      calcArea: 100
    } as unknown as SitePolygon);
    const geometry: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ]
      ]
    };
    const result = await calculator.calculate("uuid", geometry, dataApiServiceMock as unknown as DataApiService);
    expect(dataApiServiceMock.getIndicatorsDataset).toHaveBeenCalledWith(
      "umd_tree_cover_loss_from_fires",
      "SELECT umd_tree_cover_loss_from_fires__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss_from_fires__year",
      geometry
    );
    expect(result).toMatchObject({
      indicatorSlug: "treeCoverLossFires",
      sitePolygonId: 1,
      value: { 2025: 100 },
      yearOfAnalysis: 2025
    });
  });
});
