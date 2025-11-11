import { IsValidFeatureCollectionConstraint } from "./is-valid-feature-collection.decorator";
import { FeatureCollection } from "geojson";

describe("IsValidFeatureCollectionConstraint", () => {
  let constraint: IsValidFeatureCollectionConstraint;

  beforeEach(() => {
    constraint = new IsValidFeatureCollectionConstraint();
  });

  describe("validate", () => {
    it("should return true for valid FeatureCollection", () => {
      const validFC: FeatureCollection = {
        type: "FeatureCollection",
        features: []
      };
      expect(constraint.validate(validFC)).toBe(true);
    });

    it("should return false for null", () => {
      expect(constraint.validate(null)).toBe(false);
    });

    it("should return false for invalid type", () => {
      expect(constraint.validate({ type: "Feature", features: [] })).toBe(false);
    });

    it("should return false when features is not an array", () => {
      expect(constraint.validate({ type: "FeatureCollection", features: "not array" })).toBe(false);
    });
  });

  describe("defaultMessage", () => {
    it("should return error message from validator", () => {
      const args = {
        value: null,
        property: "geometries",
        constraints: [],
        targetName: "TestDto",
        object: {}
      };
      const message = constraint.defaultMessage(args);
      expect(message).toBe("FeatureCollection must be an object");
    });

    it("should return error when type is wrong", () => {
      const args = {
        value: { type: "Feature", features: [] },
        property: "geometries",
        constraints: [],
        targetName: "TestDto",
        object: {}
      };
      const message = constraint.defaultMessage(args);
      expect(message).toBe('FeatureCollection must have type "FeatureCollection"');
    });
  });
});
