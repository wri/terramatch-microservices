import { BadRequestException } from "@nestjs/common";
import {
  assertNotReservedAttributeKey,
  assertValidGeneratedKey,
  assertValidGeneratedOptionValue,
  generateAttributeKey,
  generateAttributeOptionValue
} from "./attribute-key";

describe("attribute-key", () => {
  describe("generateAttributeKey", () => {
    it("camelCases the trimmed label", () => {
      expect(generateAttributeKey("ANR Subcategory")).toBe("anrSubcategory");
      expect(generateAttributeKey("  Poly Name  ")).toBe("polyName");
    });
  });

  describe("generateAttributeOptionValue", () => {
    it("kebab-cases the trimmed label", () => {
      expect(generateAttributeOptionValue("Farmer managed")).toBe("farmer-managed");
      expect(generateAttributeOptionValue("  Assisted  ")).toBe("assisted");
    });
  });

  describe("assertValidGeneratedKey", () => {
    it("accepts camelCase identifiers", () => {
      expect(() => assertValidGeneratedKey("anrSubcategory", "ANR Subcategory")).not.toThrow();
    });

    it("rejects empty or invalid identifiers", () => {
      expect(() => assertValidGeneratedKey("", "!!!")).toThrow(BadRequestException);
      expect(() => assertValidGeneratedKey("123abc", "123 abc")).toThrow(BadRequestException);
    });
  });

  describe("assertValidGeneratedOptionValue", () => {
    it("accepts kebab-case values", () => {
      expect(() => assertValidGeneratedOptionValue("farmer-managed", "Farmer managed")).not.toThrow();
      expect(() => assertValidGeneratedOptionValue("assisted", "Assisted")).not.toThrow();
    });

    it("rejects empty or invalid values", () => {
      expect(() => assertValidGeneratedOptionValue("", "!!!")).toThrow(BadRequestException);
      expect(() => assertValidGeneratedOptionValue("-leading", "-leading")).toThrow(BadRequestException);
    });
  });

  describe("assertNotReservedAttributeKey", () => {
    it("rejects core GeoJSON property names", () => {
      expect(() => assertNotReservedAttributeKey("practice")).toThrow(BadRequestException);
      expect(() => assertNotReservedAttributeKey("polyName")).toThrow(BadRequestException);
    });

    it("allows other keys", () => {
      expect(() => assertNotReservedAttributeKey("anrSubcategory")).not.toThrow();
    });
  });
});
