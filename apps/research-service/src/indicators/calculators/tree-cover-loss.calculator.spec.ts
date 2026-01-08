import { Test, TestingModule } from "@nestjs/testing";
import { TreeCoverLossCalculator } from "./tree-cover-loss.calculator";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { SitePolygon } from "@terramatch-microservices/database/entities";

describe("TreeCoverLossCalculator", () => {
  const currentYear = new Date().getFullYear();
  let calculator: TreeCoverLossCalculator;
  const dataApiServiceMock = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([
      {
        umd_tree_cover_loss__year: currentYear,
        area__ha: 100
      }
    ])
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
    expect(result).toMatchObject({
      indicatorSlug: "treeCoverLoss",
      sitePolygonId: 1,
      value: { [currentYear]: 100 },
      yearOfAnalysis: currentYear
    });
  });
});
