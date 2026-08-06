import {
  buildTreeCoverLossValue,
  buildZeroTreeCoverLossValue,
  TREE_COVER_LOSS_START_YEAR
} from "./tree-cover-loss-value.util";

describe("tree-cover-loss-value.util", () => {
  const yearOfAnalysis = 2025;

  describe("buildZeroTreeCoverLossValue", () => {
    it("should return zero for each year from the start year through year of analysis", () => {
      expect(buildZeroTreeCoverLossValue(yearOfAnalysis)).toEqual({
        "2015": 0,
        "2016": 0,
        "2017": 0,
        "2018": 0,
        "2019": 0,
        "2020": 0,
        "2021": 0,
        "2022": 0,
        "2023": 0,
        "2024": 0,
        "2025": 0
      });
    });
  });

  describe("buildTreeCoverLossValue", () => {
    it("should return zero-filled values when GFW returns no rows", () => {
      expect(buildTreeCoverLossValue([], () => 0, yearOfAnalysis)).toEqual(buildZeroTreeCoverLossValue(yearOfAnalysis));
    });

    it("should map GFW rows to year/value pairs when data is present", () => {
      const results = [
        { umd_tree_cover_loss__year: 2018, area__ha: 0.81577 },
        { umd_tree_cover_loss__year: 2021, area__ha: 0.29664 }
      ];

      expect(buildTreeCoverLossValue(results, result => result.umd_tree_cover_loss__year, yearOfAnalysis)).toEqual({
        "2018": 0.81577,
        "2021": 0.29664
      });
    });

    it("should use the configured start year constant", () => {
      expect(TREE_COVER_LOSS_START_YEAR).toBe(2015);
    });
  });
});
