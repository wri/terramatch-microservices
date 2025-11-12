import { validateFeatureCollectionStructure } from "./geojson-structure-validator";
import { FeatureCollection } from "geojson";

describe("geojson-structure-validator", () => {
  describe("validateFeatureCollectionStructure", () => {
    it("should return valid=true for valid FeatureCollection", () => {
      const validFC: FeatureCollection = {
        type: "FeatureCollection",
        features: []
      };
      expect(validateFeatureCollectionStructure(validFC).valid).toBe(true);
    });

    it("should return valid=false for null", () => {
      const result = validateFeatureCollectionStructure(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value cannot be null or undefined");
    });

    it("should return valid=true for array of FeatureCollections", () => {
      const result = validateFeatureCollectionStructure([
        { type: "FeatureCollection", features: [] },
        { type: "FeatureCollection", features: [] }
      ]);
      expect(result.valid).toBe(true);
    });

    it("should return valid=false for invalid item in array", () => {
      const result = validateFeatureCollectionStructure([
        { type: "FeatureCollection", features: [] },
        { type: "Feature", features: [] }
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("index 1");
    });

    it("should return valid=false when type is not FeatureCollection", () => {
      const result = validateFeatureCollectionStructure({ type: "Feature", features: [] });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('FeatureCollection must have type "FeatureCollection"');
    });

    it("should return valid=false when features is not an array", () => {
      const result = validateFeatureCollectionStructure({ type: "FeatureCollection", features: "not array" });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('FeatureCollection must have a "features" array');
    });
  });
});
