import { BadRequestException } from "@nestjs/common";
import {
  assertValidPlantStart,
  buildTreeCoverLossValue,
  buildZeroTreeCoverLossValueForRange,
  getTreeCoverLossYearRange,
  TREE_COVER_LOSS_YEARS_BEFORE_PLANT_START
} from "./tree-cover-loss-value.util";

describe("tree-cover-loss-value.util", () => {
  const plantStart = new Date("2024-08-15");

  describe("getTreeCoverLossYearRange", () => {
    it("should return 10 years before plant start year through plant start year", () => {
      expect(getTreeCoverLossYearRange(plantStart)).toEqual({ startYear: 2014, endYear: 2024 });
    });

    it("should use the configured years-before-plant-start constant", () => {
      expect(TREE_COVER_LOSS_YEARS_BEFORE_PLANT_START).toBe(10);
    });
  });

  describe("assertValidPlantStart", () => {
    it("should return plantStart when valid", () => {
      expect(assertValidPlantStart(plantStart, "uuid")).toEqual(plantStart);
    });

    it("should throw when plantStart is null", () => {
      expect(() => assertValidPlantStart(null, "uuid")).toThrow(BadRequestException);
    });

    it("should throw when plantStart is invalid", () => {
      expect(() => assertValidPlantStart(new Date("invalid"), "uuid")).toThrow(BadRequestException);
    });
  });

  describe("buildZeroTreeCoverLossValueForRange", () => {
    it("should return zero for each year in the range", () => {
      expect(buildZeroTreeCoverLossValueForRange(2014, 2024)).toEqual({
        "2014": 0,
        "2015": 0,
        "2016": 0,
        "2017": 0,
        "2018": 0,
        "2019": 0,
        "2020": 0,
        "2021": 0,
        "2022": 0,
        "2023": 0,
        "2024": 0
      });
    });
  });

  describe("buildTreeCoverLossValue", () => {
    it("should return zero-filled values when GFW returns no rows", () => {
      expect(buildTreeCoverLossValue([], () => 0, plantStart)).toEqual(buildZeroTreeCoverLossValueForRange(2014, 2024));
    });

    it("should zero-fill missing years while preserving GFW values within the plant start range", () => {
      const results = [
        { umd_tree_cover_loss__year: 2016, area__ha: 0.07416 },
        { umd_tree_cover_loss__year: 2021, area__ha: 0.29664 }
      ];

      expect(buildTreeCoverLossValue(results, result => result.umd_tree_cover_loss__year, plantStart)).toEqual({
        "2014": 0,
        "2015": 0,
        "2016": 0.07416,
        "2017": 0,
        "2018": 0,
        "2019": 0,
        "2020": 0,
        "2021": 0.29664,
        "2022": 0,
        "2023": 0,
        "2024": 0
      });
    });

    it("should ignore GFW rows outside the plant start range", () => {
      const results = [
        { umd_tree_cover_loss__year: 2013, area__ha: 0.07416 },
        { umd_tree_cover_loss__year: 2025, area__ha: 0.5 }
      ];

      expect(buildTreeCoverLossValue(results, result => result.umd_tree_cover_loss__year, plantStart)).toEqual(
        buildZeroTreeCoverLossValueForRange(2014, 2024)
      );
    });
  });
});
