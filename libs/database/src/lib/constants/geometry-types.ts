export interface Geometry {
  type: "Polygon" | "MultiPolygon" | "Point";
  coordinates: number[][][] | number[][][][] | number[];
}

export interface Feature {
  geometry: Geometry;
  properties: Record<string, unknown>;
}
