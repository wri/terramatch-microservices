import type { Geometry, MultiPolygon, Polygon, Position } from "geojson";

export const LINEAR_RING_ERROR_MESSAGE = "Invalid Geometry: Linear Ring Error";

function positionsEqual(a: Position, b: Position): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function isValidLinearRing(ring: Position[]): boolean {
  if (ring.length < 4) {
    return false;
  }
  if (!positionsEqual(ring[0], ring[ring.length - 1])) {
    return false;
  }
  const open = ring.slice(0, -1);
  const unique = new Set(open.map(p => JSON.stringify(p)));
  return unique.size >= 3;
}

export function areLinearRingsValid(geometry: Geometry): boolean {
  if (geometry.type === "Polygon") {
    const coordinates = (geometry as Polygon).coordinates;
    if (coordinates.length < 1) {
      return false;
    }
    return coordinates.every(ring => isValidLinearRing(ring));
  }
  if (geometry.type === "MultiPolygon") {
    const multi = (geometry as MultiPolygon).coordinates;
    if (multi.length < 1) {
      return false;
    }
    for (const polygon of multi) {
      if (polygon.length < 1) {
        return false;
      }
      for (const ring of polygon) {
        if (!isValidLinearRing(ring)) {
          return false;
        }
      }
    }
    return true;
  }
  return true;
}
