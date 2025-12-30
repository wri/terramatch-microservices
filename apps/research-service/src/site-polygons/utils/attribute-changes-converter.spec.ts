import { convertPropertiesToAttributeChanges } from "./attribute-changes-converter";
import { SitePolygon } from "@terramatch-microservices/database/entities";

describe("AttributeChangesConverter", () => {
  describe("convertPropertiesToAttributeChanges", () => {
    it("should convert all properties to AttributeChangesDto", () => {
      const properties: Partial<SitePolygon> = {
        polyName: "Test Polygon",
        plantStart: new Date("2023-01-15T00:00:00Z"),
        practice: ["agroforestry", "planting"],
        targetSys: "agroforestry",
        distr: ["full-enrichment", "single-line"],
        numTrees: 100
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        polyName: "Test Polygon",
        poly_name: "Test Polygon",
        plantStart: "2023-01-15T00:00:00.000Z",
        plantstart: "2023-01-15T00:00:00.000Z",
        practice: ["agroforestry", "planting"],
        targetSys: "agroforestry",
        target_sys: "agroforestry",
        distr: ["full-enrichment", "single-line"],
        numTrees: 100,
        num_trees: 100
      });
    });

    it("should handle plantStart as string", () => {
      const properties: Partial<SitePolygon> = {
        plantStart: "2023-01-15T00:00:00Z" as unknown as Date
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        plantStart: "2023-01-15T00:00:00Z",
        plantstart: "2023-01-15T00:00:00Z"
      });
    });

    it("should handle plantStart as Date object", () => {
      const date = new Date("2023-06-20T12:00:00Z");
      const properties: Partial<SitePolygon> = {
        plantStart: date
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        plantStart: date.toISOString(),
        plantstart: date.toISOString()
      });
    });

    it("should exclude null properties", () => {
      const properties: Partial<SitePolygon> = {
        polyName: null,
        plantStart: null,
        practice: null,
        targetSys: null,
        distr: null,
        numTrees: null
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({});
    });

    it("should exclude undefined properties", () => {
      const properties: Partial<SitePolygon> = {
        polyName: undefined,
        plantStart: undefined,
        practice: undefined,
        targetSys: undefined,
        distr: undefined,
        numTrees: undefined
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({});
    });

    it("should exclude empty string polyName", () => {
      const properties: Partial<SitePolygon> = {
        polyName: ""
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        polyName: "",
        poly_name: ""
      });
    });

    it("should exclude empty practice array", () => {
      const properties: Partial<SitePolygon> = {
        practice: []
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({});
    });

    it("should exclude empty distr array", () => {
      const properties: Partial<SitePolygon> = {
        distr: []
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({});
    });

    it("should handle partial properties", () => {
      const properties: Partial<SitePolygon> = {
        polyName: "Partial Polygon",
        targetSys: "agroforestry"
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        polyName: "Partial Polygon",
        poly_name: "Partial Polygon",
        targetSys: "agroforestry",
        target_sys: "agroforestry"
      });
    });

    it("should handle only polyName", () => {
      const properties: Partial<SitePolygon> = {
        polyName: "Name Only"
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        polyName: "Name Only",
        poly_name: "Name Only"
      });
    });

    it("should handle only practice", () => {
      const properties: Partial<SitePolygon> = {
        practice: ["agroforestry"]
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        practice: ["agroforestry"]
      });
    });

    it("should handle only distr", () => {
      const properties: Partial<SitePolygon> = {
        distr: ["full-enrichment"]
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        distr: ["full-enrichment"]
      });
    });

    it("should handle only targetSys", () => {
      const properties: Partial<SitePolygon> = {
        targetSys: "woodlot-or-plantation"
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        targetSys: "woodlot-or-plantation",
        target_sys: "woodlot-or-plantation"
      });
    });

    it("should handle only numTrees", () => {
      const properties: Partial<SitePolygon> = {
        numTrees: 500
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        numTrees: 500,
        num_trees: 500
      });
    });

    it("should handle only plantStart", () => {
      const properties: Partial<SitePolygon> = {
        plantStart: new Date("2024-01-01T00:00:00Z")
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        plantStart: "2024-01-01T00:00:00.000Z",
        plantstart: "2024-01-01T00:00:00.000Z"
      });
    });

    it("should handle empty object", () => {
      const properties: Partial<SitePolygon> = {};

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({});
    });

    it("should handle numTrees as zero", () => {
      const properties: Partial<SitePolygon> = {
        numTrees: 0
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        numTrees: 0,
        num_trees: 0
      });
    });

    it("should handle single-item practice array", () => {
      const properties: Partial<SitePolygon> = {
        practice: ["planting"]
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        practice: ["planting"]
      });
    });

    it("should handle single-item distr array", () => {
      const properties: Partial<SitePolygon> = {
        distr: ["partial"]
      };

      const result = convertPropertiesToAttributeChanges(properties);

      expect(result).toEqual({
        distr: ["partial"]
      });
    });
  });
});
