import { BadRequestException } from "@nestjs/common";
import { assertNotReservedAttributeKey, assertValidGeneratedKey, generateAttributeKey } from "./attribute-key";

describe("attribute-key", () => {
  describe("generateAttributeKey", () => {
    it("camelCases the trimmed label", () => {
      expect(generateAttributeKey("ANR Subcategory")).toBe("anrSubcategory");
      expect(generateAttributeKey("  Poly Name  ")).toBe("polyName");
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
