import {
  validateSitePolygonProperties,
  extractAdditionalData,
  validateArrayProperty,
  orderCommaSeparatedPropertiesAlphabetically,
  validateAndSortStringArray,
  VALID_DISTRIBUTION_VALUES,
  VALID_PRACTICE_VALUES
} from "./site-polygon-property-validator";

describe("SitePolygonPropertyValidator", () => {
  describe("validateSitePolygonProperties", () => {
    it("should return valid SitePolygon object with all properties", () => {
      const properties = {
        poly_name: "Test Polygon",
        site_id: "site-uuid-123",
        plantstart: "2023-01-15",
        practice: "tree-planting",
        target_sys: "agroforest",
        distr: "full",
        num_trees: 100,
        area: 5.5,
        status: "draft",
        point_id: "point-uuid-123",
        source: "greenhouse"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result).toEqual({
        polyName: "Test Polygon",
        siteUuid: "site-uuid-123",
        plantStart: new Date("2023-01-15"),
        practice: ["tree-planting"],
        targetSys: "agroforest",
        distr: ["full"],
        numTrees: 100,
        calcArea: 5.5,
        status: "draft",
        pointUuid: "point-uuid-123",
        source: "greenhouse"
      });
    });

    it("should handle null and empty values", () => {
      const properties = {
        poly_name: "",
        site_id: null,
        plantstart: "",
        practice: "",
        target_sys: "",
        distr: "",
        num_trees: null,
        area: null,
        point_id: null,
        source: null
      };

      const result = validateSitePolygonProperties(properties);

      expect(result).toEqual({
        polyName: "",
        siteUuid: null,
        plantStart: null,
        practice: null,
        targetSys: null,
        distr: null,
        numTrees: null,
        calcArea: null,
        status: "draft",
        pointUuid: null,
        source: null
      });
    });

    it("should handle undefined values", () => {
      const properties = {
        poly_name: undefined,
        site_id: undefined,
        plantstart: undefined,
        practice: undefined,
        target_sys: undefined,
        distr: undefined,
        num_trees: undefined,
        area: undefined,
        point_id: undefined,
        source: undefined
      };

      const result = validateSitePolygonProperties(properties);

      expect(result).toEqual({
        polyName: null,
        siteUuid: null,
        plantStart: null,
        practice: null,
        targetSys: null,
        distr: null,
        numTrees: null,
        calcArea: null,
        status: "draft",
        pointUuid: null,
        source: null
      });
    });

    it("should handle invalid plantstart date", () => {
      const properties = {
        plantstart: "invalid-date"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.plantStart).toBeNull();
    });

    it("should handle valid plantstart date", () => {
      const properties = {
        plantstart: "2023-12-25T10:30:00Z"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.plantStart).toEqual(new Date("2023-12-25T10:30:00Z"));
    });

    it("should handle invalid plantstart date", () => {
      const properties = {
        plantstart: "invalid-date-format"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.plantStart).toBeNull();
    });

    it("should handle non-integer num_trees", () => {
      const properties = {
        num_trees: 100.5
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.numTrees).toBeNull();
    });

    it("should handle string num_trees", () => {
      const properties = {
        num_trees: "100"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.numTrees).toBeNull();
    });

    it("should handle valid integer num_trees", () => {
      const properties = {
        num_trees: 150
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.numTrees).toBe(150);
    });

    it("should handle zero num_trees", () => {
      const properties = {
        num_trees: 0
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.numTrees).toBe(0);
    });

    it("should handle negative num_trees", () => {
      const properties = {
        num_trees: -10
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.numTrees).toBe(-10);
    });

    it("should filter and sort valid distribution values", () => {
      const properties = {
        distr: "single-line,full,partial"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.distr).toEqual(["full", "partial", "single-line"]);
    });

    it("should filter out invalid distribution values", () => {
      const properties = {
        distr: "invalid,full,also-invalid,partial"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.distr).toEqual(["full", "partial"]);
    });

    it("should return null for empty distribution values", () => {
      const properties = {
        distr: "invalid,also-invalid"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.distr).toBeNull();
    });

    it("should handle whitespace in distribution values", () => {
      const properties = {
        distr: " full , partial , single-line "
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.distr).toEqual(["full", "partial", "single-line"]);
    });

    it("should filter and sort valid practice values", () => {
      const properties = {
        practice: "tree-planting,assisted-natural-regeneration,direct-seeding"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.practice).toEqual(["assisted-natural-regeneration", "direct-seeding", "tree-planting"]);
    });

    it("should filter out invalid practice values", () => {
      const properties = {
        practice: "invalid,tree-planting,also-invalid,direct-seeding"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.practice).toEqual(["direct-seeding", "tree-planting"]);
    });

    it("should return null for empty practice values", () => {
      const properties = {
        practice: "invalid,also-invalid"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.practice).toBeNull();
    });

    it("should handle whitespace in practice values", () => {
      const properties = {
        practice: " tree-planting , assisted-natural-regeneration "
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.practice).toEqual(["assisted-natural-regeneration", "tree-planting"]);
    });

    it("should handle empty target_sys", () => {
      const properties = {
        target_sys: ""
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.targetSys).toBeNull();
    });

    it("should handle whitespace-only target_sys", () => {
      const properties = {
        target_sys: "   "
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.targetSys).toBeNull();
    });

    it("should handle valid target_sys", () => {
      const properties = {
        target_sys: "agroforest"
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.targetSys).toBe("agroforest");
    });

    it("should trim target_sys", () => {
      const properties = {
        target_sys: "  agroforest  "
      };

      const result = validateSitePolygonProperties(properties);

      expect(result.targetSys).toBe("agroforest");
    });

    it("should handle mixed data types", () => {
      const properties = {
        poly_name: 123,
        site_id: true,
        plantstart: 2023,
        practice: null,
        target_sys: null,
        distr: null,
        num_trees: "not-a-number",
        area: "not-a-number",
        point_id: [],
        source: {}
      };

      const result = validateSitePolygonProperties(properties);

      expect(result).toEqual({
        polyName: 123,
        siteUuid: true,
        plantStart: new Date(2023),
        practice: null,
        targetSys: null,
        distr: null,
        numTrees: null,
        calcArea: "not-a-number",
        status: "draft",
        pointUuid: [],
        source: {}
      });
    });

    it("should handle non-string values that cause trim errors", () => {
      const properties = {
        target_sys: false,
        distr: 456,
        practice: true
      };

      expect(() => validateSitePolygonProperties(properties)).toThrow();
    });

    it("should handle target_sys that becomes empty after trim", () => {
      const properties = {
        target_sys: "test"
      };

      const originalTrim = String.prototype.trim;
      let trimCallCount = 0;
      String.prototype.trim = jest.fn(function (this: string) {
        trimCallCount++;
        // First call (in the check) returns non-empty, second call returns empty
        if (trimCallCount === 1) {
          return "non-empty";
        }
        return "";
      });

      const result = validateSitePolygonProperties(properties);

      expect(result.targetSys).toBeNull();

      // Restore original trim
      String.prototype.trim = originalTrim;
    });

    describe("extractAdditionalData", () => {
      it("should extract non-core properties", () => {
        const properties = {
          poly_name: "Test Polygon",
          site_id: "site-uuid-123",
          custom_field: "custom_value",
          another_field: 123,
          nested_object: { key: "value" }
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({
          custom_field: "custom_value",
          another_field: 123,
          nested_object: { key: "value" }
        });
      });

      it("should exclude core properties", () => {
        const properties = {
          poly_name: "Test Polygon",
          site_id: "site-uuid-123",
          plantstart: "2023-01-15",
          practice: "tree-planting",
          target_sys: "agroforest",
          distr: "full",
          num_trees: 100,
          area: 5.5,
          status: "draft",
          point_id: "point-uuid-123",
          source: "greenhouse",
          custom_field: "custom_value"
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({
          custom_field: "custom_value"
        });
      });

      it("should exclude excluded properties", () => {
        const properties = {
          area: 5.5,
          uuid: "some-uuid",
          custom_field: "custom_value"
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({
          custom_field: "custom_value"
        });
      });

      it("should return empty object when no additional data", () => {
        const properties = {
          poly_name: "Test Polygon",
          site_id: "site-uuid-123",
          plantstart: "2023-01-15",
          practice: "tree-planting",
          target_sys: "agroforest",
          distr: "full",
          num_trees: 100,
          area: 5.5,
          status: "draft",
          point_id: "point-uuid-123",
          source: "greenhouse"
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({});
      });

      it("should handle empty properties object", () => {
        const properties = {};

        const result = extractAdditionalData(properties);

        expect(result).toEqual({});
      });

      it("should handle null and undefined values in additional data", () => {
        const properties = {
          poly_name: "Test Polygon",
          custom_field: "custom_value",
          null_field: null,
          undefined_field: undefined,
          empty_string: ""
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({
          custom_field: "custom_value",
          null_field: null,
          undefined_field: undefined,
          empty_string: ""
        });
      });

      it("should handle complex nested objects", () => {
        const properties = {
          poly_name: "Test Polygon",
          complex_data: {
            nested: {
              deep: {
                value: "test"
              }
            },
            array: [1, 2, 3],
            boolean: true
          }
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({
          complex_data: {
            nested: {
              deep: {
                value: "test"
              }
            },
            array: [1, 2, 3],
            boolean: true
          }
        });
      });

      it("should handle arrays as additional data", () => {
        const properties = {
          poly_name: "Test Polygon",
          tags: ["tag1", "tag2", "tag3"],
          numbers: [1, 2, 3, 4, 5]
        };

        const result = extractAdditionalData(properties);

        expect(result).toEqual({
          tags: ["tag1", "tag2", "tag3"],
          numbers: [1, 2, 3, 4, 5]
        });
      });
    });
  });

  describe("validateArrayProperty", () => {
    it("should handle array input", () => {
      const result = validateArrayProperty(["full", "partial"], VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial"]);
    });

    it("should handle array input with whitespace", () => {
      const result = validateArrayProperty([" full ", " partial "], VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial"]);
    });

    it("should handle array input with non-string values", () => {
      const result = validateArrayProperty([123, "full", true], VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full"]);
    });

    it("should handle JSON string array input", () => {
      const result = validateArrayProperty('["full", "partial", "single-line"]', VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial", "single-line"]);
    });

    it("should handle JSON string array input with whitespace", () => {
      const result = validateArrayProperty('[" full ", " partial "]', VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial"]);
    });

    it("should handle invalid JSON string that falls back to comma-separated", () => {
      const result = validateArrayProperty("[invalid json, full", VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full"]);
    });

    it("should handle JSON string that is not an array", () => {
      const result = validateArrayProperty('{"key": "value"}', VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null for empty array input", () => {
      const result = validateArrayProperty([], VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null for array with only invalid values", () => {
      const result = validateArrayProperty(["invalid1", "invalid2"], VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });
  });

  describe("orderCommaSeparatedPropertiesAlphabetically", () => {
    it("should return sorted valid values", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically("single-line,full,partial", VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial", "single-line"]);
    });

    it("should filter out invalid values", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically(
        "invalid,full,also-invalid,partial",
        VALID_DISTRIBUTION_VALUES
      );
      expect(result).toEqual(["full", "partial"]);
    });

    it("should return null for empty string", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically("", VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only string", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically("   ", VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null for null input", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically(null as any, VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null when all values are invalid", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically("invalid1,invalid2", VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should handle whitespace in values", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically(
        " full , partial , single-line ",
        VALID_DISTRIBUTION_VALUES
      );
      expect(result).toEqual(["full", "partial", "single-line"]);
    });

    it("should handle practice values", () => {
      const result = orderCommaSeparatedPropertiesAlphabetically(
        "tree-planting,assisted-natural-regeneration,direct-seeding",
        VALID_PRACTICE_VALUES
      );
      expect(result).toEqual(["assisted-natural-regeneration", "direct-seeding", "tree-planting"]);
    });
  });

  describe("validateAndSortStringArray", () => {
    it("should return sorted valid values from array", () => {
      const result = validateAndSortStringArray(["single-line", "full", "partial"], VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial", "single-line"]);
    });

    it("should filter out invalid values", () => {
      const result = validateAndSortStringArray(
        ["invalid", "full", "also-invalid", "partial"],
        VALID_DISTRIBUTION_VALUES
      );
      expect(result).toEqual(["full", "partial"]);
    });

    it("should return null for null input", () => {
      const result = validateAndSortStringArray(null, VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null for undefined input", () => {
      const result = validateAndSortStringArray(undefined, VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null for empty array", () => {
      const result = validateAndSortStringArray([], VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should return null when input is not an array", () => {
      const result = validateAndSortStringArray("not-an-array" as any, VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should handle whitespace in values", () => {
      const result = validateAndSortStringArray([" full ", " partial ", " single-line "], VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial", "single-line"]);
    });

    it("should filter out non-string values", () => {
      const result = validateAndSortStringArray([123, "full", true, "partial"] as any, VALID_DISTRIBUTION_VALUES);
      expect(result).toEqual(["full", "partial"]);
    });

    it("should return null when all values are invalid", () => {
      const result = validateAndSortStringArray(["invalid1", "invalid2"], VALID_DISTRIBUTION_VALUES);
      expect(result).toBeNull();
    });

    it("should handle practice values", () => {
      const result = validateAndSortStringArray(
        ["tree-planting", "assisted-natural-regeneration", "direct-seeding"],
        VALID_PRACTICE_VALUES
      );
      expect(result).toEqual(["assisted-natural-regeneration", "direct-seeding", "tree-planting"]);
    });
  });
});
