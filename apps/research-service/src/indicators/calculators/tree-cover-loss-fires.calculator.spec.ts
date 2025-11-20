import { Test, TestingModule } from "@nestjs/testing";
import { TreeCoverLossFiresCalculator } from "./tree-cover-loss-fires.calculator";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";

describe("TreeCoverLossFiresCalculator", () => {
  let calculator: TreeCoverLossFiresCalculator;
  let dataApiServiceMock = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
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
    expect(result).toBe(0);
  });
});
