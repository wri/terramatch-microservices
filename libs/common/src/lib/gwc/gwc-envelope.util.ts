import proj4 from "proj4";

const WGS84_CRS = "EPSG:4326";
// EPSG:900913 is GWC/Google's historical alias for EPSG:3857 (Web Mercator) - numerically identical.
const WEB_MERCATOR_CRS = "EPSG:3857";

// Full width of the Web Mercator plane, in meters (-20037508.342789244 to +20037508.342789244).
const WEB_MERCATOR_WORLD_WIDTH_METERS = 2 * 20037508.342789244;

export type LngLatEnvelope = [minLng: number, minLat: number, maxLng: number, maxLat: number];
export type MercatorEnvelope = [minX: number, minY: number, maxX: number, maxY: number];

/**
 * Reprojects an EPSG:4326 (lon/lat) envelope to EPSG:3857/900913 meters, as required by GWC's
 * seed/truncate REST API when targeting the EPSG:900913 gridset.
 */
export const toWebMercator = ([minLng, minLat, maxLng, maxLat]: LngLatEnvelope): MercatorEnvelope => {
  const toMercator = proj4(WGS84_CRS, WEB_MERCATOR_CRS);
  const [minX, minY] = toMercator.forward([minLng, minLat]);
  const [maxX, maxY] = toMercator.forward([maxLng, maxLat]);
  return [minX, minY, maxX, maxY];
};

// Width, in meters, of a single tile at the given zoom level on the Web Mercator grid.
export const tileWidthMetersAtZoom = (zoom: number): number => WEB_MERCATOR_WORLD_WIDTH_METERS / 2 ** zoom;

/**
 * Grows an EPSG:900913 envelope outward by a fixed number of meters on every side.
 *
 * This exists because GWC renders and stores a whole metatile (a block of tiles, e.g. 4x4) in a
 * single pass whenever any tile inside it is missing from the cache. If a truncate request only
 * covers part of a metatile, the untouched tiles in that same metatile keep serving their
 * pre-edit render. Padding the envelope by a couple of tile widths guarantees every metatile the
 * edit could touch is fully evicted.
 *
 * The padding is computed once at a representative "mid" zoom level rather than per zoom level:
 * at lower zooms tiles are huge, so this fixed padding is negligible overhead; at higher zooms
 * tiles are tiny, so the same fixed padding comfortably over-covers. A single value is simpler
 * and safe across the whole zoom range we truncate.
 */
export const padEnvelopeForMetatiles = (
  [minX, minY, maxX, maxY]: MercatorEnvelope,
  { padZoom, padTileWidths }: { padZoom: number; padTileWidths: number }
): MercatorEnvelope => {
  const paddingMeters = tileWidthMetersAtZoom(padZoom) * padTileWidths;
  return [minX - paddingMeters, minY - paddingMeters, maxX + paddingMeters, maxY + paddingMeters];
};
