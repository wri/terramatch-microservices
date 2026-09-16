import { BadRequestException } from "@nestjs/common";
import { literal } from "sequelize";
import { buildSitePolygonSortOrder, SITE_POLYGON_SORT_FIELDS } from "./site-polygon-sort";

describe("site-polygon-sort", () => {
  describe("buildSitePolygonSortOrder", () => {
    it.each([
      ["name", "polyName"],
      ["status", "status"],
      ["createdAt", "createdAt"],
      ["validationStatus", "validationStatus"],
      ["plantStart", "plantStart"],
      ["numTrees", "numTrees"],
      ["calcArea", "calcArea"],
      ["targetSys", "targetSys"],
      ["submissionCycle", "submissionCycle"],
      ["source", "source"]
    ] as const)("maps %s to column %s", (field, column) => {
      expect(buildSitePolygonSortOrder(field, "DESC")).toEqual([[column, "DESC"]]);
      expect(buildSitePolygonSortOrder(field)).toEqual([[column, "ASC"]]);
    });

    it("builds practice order using joined codes in alphabetical order", () => {
      const order = buildSitePolygonSortOrder("practice", "ASC");
      expect(order).toHaveLength(1);
      const [expression, direction] = order[0] as [ReturnType<typeof literal>, string];
      expect(direction).toBe("ASC");
      expect(expression).toEqual(
        literal(
          "CONCAT_WS(', ', " +
            "IF(JSON_CONTAINS(SitePolygon.practice, '\"assisted-natural-regeneration\"', '$') = 1, 'assisted-natural-regeneration', NULL), " +
            "IF(JSON_CONTAINS(SitePolygon.practice, '\"direct-seeding\"', '$') = 1, 'direct-seeding', NULL), " +
            "IF(JSON_CONTAINS(SitePolygon.practice, '\"sapling-planting\"', '$') = 1, 'sapling-planting', NULL), " +
            "IF(JSON_CONTAINS(SitePolygon.practice, '\"tree-planting\"', '$') = 1, 'tree-planting', NULL))"
        )
      );
    });

    it("builds distr order using joined codes in alphabetical order", () => {
      const order = buildSitePolygonSortOrder("distr", "DESC");
      expect(order).toHaveLength(1);
      const [expression, direction] = order[0] as [ReturnType<typeof literal>, string];
      expect(direction).toBe("DESC");
      expect(expression).toEqual(
        literal(
          "CONCAT_WS(', ', " +
            "IF(JSON_CONTAINS(SitePolygon.distr, '\"full\"', '$') = 1, 'full', NULL), " +
            "IF(JSON_CONTAINS(SitePolygon.distr, '\"partial\"', '$') = 1, 'partial', NULL), " +
            "IF(JSON_CONTAINS(SitePolygon.distr, '\"single-line\"', '$') = 1, 'single-line', NULL))"
        )
      );
    });

    it("throws for an unrecognized sort field", () => {
      expect(() => buildSitePolygonSortOrder("invalid")).toThrow(BadRequestException);
      expect(() => buildSitePolygonSortOrder("invalid")).toThrow("Invalid sort field: invalid");
    });

    it("exposes every field the workspace table needs", () => {
      expect(SITE_POLYGON_SORT_FIELDS).toEqual(
        expect.arrayContaining([
          "name",
          "status",
          "createdAt",
          "validationStatus",
          "plantStart",
          "numTrees",
          "calcArea",
          "targetSys",
          "submissionCycle",
          "source",
          "practice",
          "distr"
        ])
      );
    });
  });
});
