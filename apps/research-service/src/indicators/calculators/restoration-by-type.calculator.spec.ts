import { RestorationByTypeCalculator } from "./restoration-by-type.calculator";
import { Polygon } from "geojson";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

describe("RestorationByTypeCalculator", () => {
  const currentYear = new Date().getFullYear();
  let calculator: RestorationByTypeCalculator;

  beforeEach(async () => {
    jest.clearAllMocks();

    calculator = new RestorationByTypeCalculator("practice", "restorationByStrategy");
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
    const mockSitePolygon = {
      id: 1,
      practice: ["test"],
      calcArea: 100,
      get: jest.fn((key: string) => (mockSitePolygon as unknown as Record<string, unknown>)[key])
    } as unknown as SitePolygon;
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);
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
    expect(result).toMatchObject({
      indicatorSlug: "restorationByStrategy",
      sitePolygonId: 1,
      value: { test: 100 },
      yearOfAnalysis: currentYear
    });
  });

  it("should calculate the area if the site polygon does not have a calcArea", async () => {
    const mockSitePolygon = {
      id: 1,
      practice: ["test"],
      calcArea: null,
      get: jest.fn((key: string) => (mockSitePolygon as unknown as Record<string, unknown>)[key])
    } as unknown as SitePolygon;
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);
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
    expect(result).toMatchObject({
      indicatorSlug: "restorationByStrategy",
      sitePolygonId: 1,
      value: { test: 100 },
      yearOfAnalysis: currentYear
    });
    expect(PolygonGeometry.calculateArea).toHaveBeenCalledWith(geometry);
  });
});
