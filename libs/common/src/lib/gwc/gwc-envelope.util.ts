import proj4 from "proj4";

const WGS84_CRS = "EPSG:4326";
const WEB_MERCATOR_CRS = "EPSG:3857";
const WEB_MERCATOR_WORLD_WIDTH_METERS = 2 * 20037508.342789244;

export type LngLatEnvelope = [minLng: number, minLat: number, maxLng: number, maxLat: number];
export type MercatorEnvelope = [minX: number, minY: number, maxX: number, maxY: number];

export const parseLngLatEnvelope = (bbox: number[]): LngLatEnvelope | null => {
  if (bbox.length !== 4) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  if ([minLng, minLat, maxLng, maxLat].some(value => value == null || Number.isNaN(value))) {
    return null;
  }
  return [minLng, minLat, maxLng, maxLat];
};

export const toWebMercator = ([minLng, minLat, maxLng, maxLat]: LngLatEnvelope): MercatorEnvelope => {
  const toMercator = proj4(WGS84_CRS, WEB_MERCATOR_CRS);
  const [minX, minY] = toMercator.forward([minLng, minLat]);
  const [maxX, maxY] = toMercator.forward([maxLng, maxLat]);
  return [minX, minY, maxX, maxY];
};

export const tileWidthMetersAtZoom = (zoom: number): number => WEB_MERCATOR_WORLD_WIDTH_METERS / 2 ** zoom;

export const padEnvelopeForMetatiles = (
  [minX, minY, maxX, maxY]: MercatorEnvelope,
  { padZoom, padTileWidths }: { padZoom: number; padTileWidths: number }
): MercatorEnvelope => {
  const paddingMeters = tileWidthMetersAtZoom(padZoom) * padTileWidths;
  return [minX - paddingMeters, minY - paddingMeters, maxX + paddingMeters, maxY + paddingMeters];
};
