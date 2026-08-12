import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { TreeCoverLossFiresCalculator } from "./tree-cover-loss-fires.calculator";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { buildZeroTreeCoverLossValueForRange } from "./tree-cover-loss-value.util";

describe("TreeCoverLossFiresCalculator", () => {
  const currentYear = new Date().getFullYear();
  const plantStart = new Date("2024-08-15");
  let calculator: TreeCoverLossFiresCalculator;
  const dataApiServiceMock = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([
      {
        umd_tree_cover_loss_from_fires__year: 24,
        area__ha: 100
      }
    ])
  };

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

  it("should calculate the tree cover loss fires using the plant start year range", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      plantStart
    } as unknown as SitePolygon);

    const result = await calculator.calculate("uuid", geometry, dataApiServiceMock as unknown as DataApiService);

    expect(dataApiServiceMock.getIndicatorsDataset).toHaveBeenCalledWith(
      "umd_tree_cover_loss_from_fires",
      "SELECT umd_tree_cover_loss_from_fires__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss_from_fires__year",
      geometry
    );
    expect(result).toMatchObject({
      indicatorSlug: "treeCoverLossFires",
      sitePolygonId: 1,
      yearOfAnalysis: currentYear,
      value: {
        ...buildZeroTreeCoverLossValueForRange(2014, 2024),
        "2024": 100
      }
    });
  });

  it("should return zero values for all years when GFW returns no rows", async () => {
    dataApiServiceMock.getIndicatorsDataset.mockResolvedValue([]);
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      plantStart
    } as unknown as SitePolygon);

    const result = await calculator.calculate("uuid", geometry, dataApiServiceMock as unknown as DataApiService);

    expect(result.value).toEqual(buildZeroTreeCoverLossValueForRange(2014, 2024));
  });

  it("should fail when plantStart is missing", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      plantStart: null
    } as unknown as SitePolygon);

    await expect(calculator.calculate("uuid", geometry, dataApiServiceMock as unknown as DataApiService)).rejects.toThrow(
      BadRequestException
    );
  });
});
