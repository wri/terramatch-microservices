import {
  padEnvelopeForMetatiles,
  parseLngLatEnvelope,
  tileWidthMetersAtZoom,
  toWebMercator
} from "./gwc-envelope.util";

describe("gwc-envelope.util", () => {
  describe("parseLngLatEnvelope", () => {
    it("returns a typed envelope for a valid 4-number bbox", () => {
      expect(parseLngLatEnvelope([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    });

    it("returns null when length is not 4", () => {
      expect(parseLngLatEnvelope([1, 2, 3])).toBeNull();
      expect(parseLngLatEnvelope([1, 2, 3, 4, 5])).toBeNull();
    });

    it("returns null when any value is NaN", () => {
      expect(parseLngLatEnvelope([1, 2, Number.NaN, 4])).toBeNull();
    });
  });

  describe("toWebMercator", () => {
    it("maps [0,0,0,0] to the Web Mercator origin", () => {
      const [minX, minY, maxX, maxY] = toWebMercator([0, 0, 0, 0]);
      expect(minX).toBeCloseTo(0, 6);
      expect(minY).toBeCloseTo(0, 6);
      expect(maxX).toBeCloseTo(0, 6);
      expect(maxY).toBeCloseTo(0, 6);
    });

    it("reprojects a known lon/lat envelope to the expected meters envelope", () => {
      const [minX, minY, maxX, maxY] = toWebMercator([-180, 0, 180, 0]);
      expect(minX).toBeCloseTo(-20037508.342789244, 3);
      expect(maxX).toBeCloseTo(20037508.342789244, 3);
      expect(minY).toBeCloseTo(0, 3);
      expect(maxY).toBeCloseTo(0, 3);
    });

    it("preserves min/max ordering for a small real-world bbox", () => {
      const [minX, minY, maxX, maxY] = toWebMercator([36.8, -1.3, 36.85, -1.25]);
      expect(minX).toBeLessThan(maxX);
      expect(minY).toBeLessThan(maxY);
    });
  });

  describe("tileWidthMetersAtZoom", () => {
    it("halves for each increasing zoom level", () => {
      const z10 = tileWidthMetersAtZoom(10);
      const z11 = tileWidthMetersAtZoom(11);
      expect(z11).toBeCloseTo(z10 / 2, 6);
    });

    it("matches the well-known z0 tile width (the full world)", () => {
      expect(tileWidthMetersAtZoom(0)).toBeCloseTo(2 * 20037508.342789244, 3);
    });
  });

  describe("padEnvelopeForMetatiles", () => {
    it("grows the envelope symmetrically on every side", () => {
      const envelope: [number, number, number, number] = [0, 0, 1000, 1000];
      const padded = padEnvelopeForMetatiles(envelope, { padZoom: 12, padTileWidths: 2 });
      const expectedPadding = tileWidthMetersAtZoom(12) * 2;

      expect(padded[0]).toBeCloseTo(0 - expectedPadding, 6);
      expect(padded[1]).toBeCloseTo(0 - expectedPadding, 6);
      expect(padded[2]).toBeCloseTo(1000 + expectedPadding, 6);
      expect(padded[3]).toBeCloseTo(1000 + expectedPadding, 6);
    });

    it("produces a larger padding at lower zoom levels than at higher zoom levels", () => {
      const envelope: [number, number, number, number] = [0, 0, 1000, 1000];
      const paddedLowZoom = padEnvelopeForMetatiles(envelope, { padZoom: 4, padTileWidths: 2 });
      const paddedHighZoom = padEnvelopeForMetatiles(envelope, { padZoom: 18, padTileWidths: 2 });

      const lowZoomPadding = envelope[2] - paddedLowZoom[2];
      const highZoomPadding = envelope[2] - paddedHighZoom[2];

      expect(Math.abs(lowZoomPadding)).toBeGreaterThan(Math.abs(highZoomPadding));
    });

    it("returns the original envelope when padTileWidths is 0", () => {
      const envelope: [number, number, number, number] = [10, 20, 30, 40];
      expect(padEnvelopeForMetatiles(envelope, { padZoom: 12, padTileWidths: 0 })).toEqual(envelope);
    });
  });
});
