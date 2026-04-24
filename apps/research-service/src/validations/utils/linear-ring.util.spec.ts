import { areLinearRingsValid, isValidLinearRing } from "./linear-ring.util";
import { MultiPolygon, Polygon } from "geojson";

const validClosedTriangle: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 0]
    ]
  ]
};

describe("linear-ring.util", () => {
  describe("isValidLinearRing", () => {
    it("rejects a ring with only two duplicate positions", () => {
      expect(
        isValidLinearRing([
          [1, 2],
          [1, 2]
        ])
      ).toBe(false);
    });

    it("rejects a three-position ring (GeoJSON must repeat first point to close)", () => {
      expect(
        isValidLinearRing([
          [0, 0],
          [1, 0],
          [0, 0]
        ])
      ).toBe(false);
    });

    it("accepts a minimal valid triangle ring", () => {
      expect(
        isValidLinearRing([
          [0, 0],
          [1, 0],
          [0, 1],
          [0, 0]
        ])
      ).toBe(true);
    });
  });

  describe("areLinearRingsValid", () => {
    it("rejects empty polygon coordinates", () => {
      const g: Polygon = { type: "Polygon", coordinates: [] };
      expect(areLinearRingsValid(g)).toBe(false);
    });

    it("rejects a polygon with a degenerate outer ring (two points)", () => {
      const g: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [29.32, -1.85],
            [29.32, -1.85]
          ]
        ]
      };
      expect(areLinearRingsValid(g)).toBe(false);
    });

    it("accepts a valid simple polygon", () => {
      expect(areLinearRingsValid(validClosedTriangle)).toBe(true);
    });

    it("validates each ring in a polygon with a hole", () => {
      const g: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0]
          ],
          [
            [2, 2],
            [8, 2],
            [8, 8],
            [2, 8],
            [2, 2]
          ]
        ]
      };
      expect(areLinearRingsValid(g)).toBe(true);
    });

    it("rejects an invalid inner ring", () => {
      const g: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0]
          ],
          [
            [2, 2],
            [8, 2]
          ]
        ]
      };
      expect(areLinearRingsValid(g)).toBe(false);
    });

    it("rejects an empty MultiPolygon", () => {
      const g: MultiPolygon = { type: "MultiPolygon", coordinates: [] };
      expect(areLinearRingsValid(g)).toBe(false);
    });
  });
});
