import { normalizedFileName, timestampFileName } from "./fileNames";

describe("fileNames", () => {
  describe("normalizedFileName", () => {
    it("replaces each forward slash and backslash so a name can't add a folder", () => {
      expect(normalizedFileName("Reforest 2024/2025 polygons")).toBe("Reforest 2024-2025 polygons.csv");
      expect(normalizedFileName("Reforest 2024\\2025/2026", ".geojson")).toBe("Reforest 2024-2025-2026.geojson");
    });

    it("leaves names without slashes alone", () => {
      expect(normalizedFileName("Project polygons", ".geojson")).toBe("Project polygons.geojson");
    });
  });

  describe("timestampFileName", () => {
    it("normalizes the prefix and appends the timestamp", () => {
      expect(timestampFileName("Reforest 2024/2025", ".geojson")).toMatch(
        /^Reforest 2024-2025 - \d{4}-\d{2}-\d{2} \d{2}_\d{2}_\d{2}\.geojson$/
      );
    });
  });
});
