import { Polygon } from "geojson";
import { RestorationByEcoRegionCalculator } from "./restoration-by-eco-region.calculator";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { DataApiService } from "@terramatch-microservices/data-api";

describe("RestorationByEcoRegionCalculator", () => {
  let calculator: RestorationByEcoRegionCalculator;
  const ecoRegion1 = {
    eco_name: "ecoRegion1",
    realm: "realm"
  };
  const ecoRegion2 = {
    eco_name: "ecoRegion2",
    realm: "realm"
  };
  const dataApiServiceMock = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([ecoRegion1, ecoRegion2])
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    calculator = new RestorationByEcoRegionCalculator();
  });

  it("should be defined", () => {
    expect(calculator).toBeDefined();
  });

  it("should throw an error if the site polygon is not found", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);
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
    await expect(
      calculator.calculate("uuid", geometry, dataApiServiceMock as unknown as DataApiService)
    ).rejects.toThrow(NotFoundException);
  });

  it("should calculate the area if the site polygon does not have a calcArea", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      calcArea: null
    } as unknown as SitePolygon);
    jest.spyOn(PolygonGeometry, "calculateArea").mockResolvedValue(100);
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
      ecoRegion1: 100,
      ecoRegion2: 100,
      realm: "realm"
    });
  });

  it("should calculate the restoration by eco region", async () => {
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
      "wwf_terrestrial_ecoregions",
      "SELECT eco_name, realm FROM results",
      geometry
    );
    expect(result).toMatchObject({
      ecoRegion1: 100,
      ecoRegion2: 100,
      realm: "realm"
    });
  });
});
