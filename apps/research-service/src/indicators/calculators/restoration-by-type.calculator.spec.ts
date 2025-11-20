import { RestorationByTypeCalculator } from "./restoration-by-type.calculator";
import { Polygon } from "geojson";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

describe("RestorationByTypeCalculator", () => {
  let calculator: RestorationByTypeCalculator;

  beforeEach(async () => {
    jest.clearAllMocks();

    calculator = new RestorationByTypeCalculator("practice");
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
    await expect(calculator.calculate("uuid", geometry)).rejects.toThrow(NotFoundException);
  });

  it("should return the already calculated area if the site polygon has a calcArea", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      practice: ["test"],
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
    const result = await calculator.calculate("uuid", geometry);
    expect(result).toBe(100);
  });

  it("should calculate the area if the site polygon does not have a calcArea", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      practice: ["test"],
      calcArea: null
    } as unknown as SitePolygon);
    jest.spyOn(PolygonGeometry, "calculateArea").mockResolvedValue(100);
    const geometry = {
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
    } as Polygon;
    const result = await calculator.calculate("uuid", geometry);
    expect(result).toBe(100);
    expect(PolygonGeometry.calculateArea).toHaveBeenCalledWith(geometry);
  });
});
