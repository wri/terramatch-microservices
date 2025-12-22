import { Test, TestingModule } from "@nestjs/testing";
import { GeometryTypeValidator } from "./geometry-type.validator";
import { Point, Polygon, MultiPolygon, LineString } from "geojson";

describe("GeometryTypeValidator", () => {
  let validator: GeometryTypeValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeometryTypeValidator]
    }).compile();

    validator = module.get<GeometryTypeValidator>(GeometryTypeValidator);
  });

  describe("validateGeometry", () => {
    it("should return valid=true for Polygon", async () => {
      const geometry: Polygon = { type: "Polygon", coordinates: [] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=true for MultiPolygon", async () => {
      const geometry: MultiPolygon = { type: "MultiPolygon", coordinates: [] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=true for Point", async () => {
      const geometry: Point = { type: "Point", coordinates: [0, 0] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=false for LineString", async () => {
      const geometry: LineString = { type: "LineString", coordinates: [] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(false);
      expect(result.extraInfo?.actualType).toBe("LineString");
      expect(result.extraInfo?.validTypes).toEqual(["Polygon", "MultiPolygon", "Point"]);
    });
  });
});
