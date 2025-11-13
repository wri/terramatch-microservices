import {
  isPolygonValidator,
  isGeometryValidator,
  Validator,
  PolygonValidator,
  GeometryValidator
} from "./validator.interface";

describe("validator.interface", () => {
  describe("isPolygonValidator", () => {
    it("should return false for null", () => {
      expect(isPolygonValidator(null as unknown as Validator)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPolygonValidator(undefined as unknown as Validator)).toBe(false);
    });

    it("should return true for valid PolygonValidator", () => {
      const validator: PolygonValidator = {
        validatePolygon: jest.fn()
      };
      expect(isPolygonValidator(validator)).toBe(true);
    });

    it("should return false for object without validatePolygon method", () => {
      const validator = {
        someOtherMethod: jest.fn()
      };
      expect(isPolygonValidator(validator as unknown as Validator)).toBe(false);
    });

    it("should return false for object with validatePolygon that is not a function", () => {
      const validator = {
        validatePolygon: "not a function"
      };
      expect(isPolygonValidator(validator as unknown as Validator)).toBe(false);
    });
  });

  describe("isGeometryValidator", () => {
    it("should return false for null", () => {
      expect(isGeometryValidator(null as unknown as Validator)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isGeometryValidator(undefined as unknown as Validator)).toBe(false);
    });

    it("should return true for valid GeometryValidator", () => {
      const validator: GeometryValidator = {
        validateGeometry: jest.fn()
      };
      expect(isGeometryValidator(validator)).toBe(true);
    });

    it("should return false for object without validateGeometry method", () => {
      const validator = {
        someOtherMethod: jest.fn()
      };
      expect(isGeometryValidator(validator as unknown as Validator)).toBe(false);
    });

    it("should return false for object with validateGeometry that is not a function", () => {
      const validator = {
        validateGeometry: "not a function"
      };
      expect(isGeometryValidator(validator as unknown as Validator)).toBe(false);
    });

    it("should return true for validator that implements both interfaces", () => {
      const validator: PolygonValidator & GeometryValidator = {
        validatePolygon: jest.fn(),
        validateGeometry: jest.fn()
      };
      expect(isPolygonValidator(validator)).toBe(true);
      expect(isGeometryValidator(validator)).toBe(true);
    });
  });
});
