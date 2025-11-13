import { Test, TestingModule } from "@nestjs/testing";
import { FeatureBoundsValidator } from "./feature-bounds.validator";
import { Point, Polygon, MultiPolygon, LineString } from "geojson";

describe("FeatureBoundsValidator", () => {
  let validator: FeatureBoundsValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureBoundsValidator]
    }).compile();

    validator = module.get<FeatureBoundsValidator>(FeatureBoundsValidator);
  });

  describe("validateGeometry", () => {
    it("should return valid=true for Point with valid coordinates", async () => {
      const geometry: Point = { type: "Point", coordinates: [0, 0] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=false for Point with invalid latitude", async () => {
      const geometry: Point = { type: "Point", coordinates: [0, 100] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(false);
      expect(result.extraInfo?.invalidCoordinates).toHaveLength(1);
    });

    it("should return valid=false for Point with invalid longitude", async () => {
      const geometry: Point = { type: "Point", coordinates: [200, 0] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(false);
      expect(result.extraInfo?.invalidCoordinates).toHaveLength(1);
    });

    it("should return valid=true for Polygon with valid coordinates", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0]
          ]
        ]
      };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=false for Polygon with invalid coordinates", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [200, 0],
            [0, 100],
            [1, 1],
            [1, 0],
            [200, 0]
          ]
        ]
      };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(false);
      expect(result.extraInfo?.invalidCoordinates.length).toBeGreaterThan(0);
    });

    it("should return valid=true for MultiPolygon with valid coordinates", async () => {
      const geometry: MultiPolygon = {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0]
            ]
          ]
        ]
      };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=true for other geometry types", async () => {
      const geometry: LineString = {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1]
        ]
      };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
    });
  });
});
