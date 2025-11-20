import { Test, TestingModule } from "@nestjs/testing";
import { TreeCoverLossCalculator } from "./tree-cover-loss.calculator";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";

describe("TreeCoverLossCalculator", () => {
  let calculator: TreeCoverLossCalculator;
  let dataApiServiceMock = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreeCoverLossCalculator,
        {
          provide: DataApiService,
          useValue: dataApiServiceMock
        }
      ]
    }).compile();

    calculator = module.get<TreeCoverLossCalculator>(TreeCoverLossCalculator);
  });

  it("should be defined", () => {
    expect(calculator).toBeDefined();
  });

  it("should calculate the tree cover loss", async () => {
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
      "umd_tree_cover_loss",
      "SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss__year",
      geometry
    );
    expect(result).toBe(0);
  });
});
