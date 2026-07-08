import { BadRequestException } from "@nestjs/common";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { areLinearRingsValid, LINEAR_RING_ERROR_MESSAGE } from "../validations/utils/linear-ring.util";

export const GEOMETRY_UPLOAD_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const GEOMETRY_UPLOAD_ERROR_MESSAGES = {
  MIXED_GEOMETRY_TYPES: "File contains both points and polygons",
  COORDINATE_3D: "File contains 3D coordinates",
  PROJECTION: "Unsupported coordinate projection",
  FILE_SIZE_EXCEEDED: "File exceeds maximum upload size of 50MB"
} as const;

const POINT_GEOMETRY_TYPES = new Set(["Point", "MultiPoint"]);
const POLYGON_GEOMETRY_TYPES = new Set(["Polygon", "MultiPolygon"]);

export function assertGeometryUploadFileSize(file: Express.Multer.File): void {
  if (file.size > GEOMETRY_UPLOAD_MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException(GEOMETRY_UPLOAD_ERROR_MESSAGES.FILE_SIZE_EXCEEDED);
  }
}

export function assertShapefileProjection(prjContent: string | null): void {
  if (prjContent == null || prjContent.trim() === "") {
    return;
  }

  const normalized = prjContent.trim();
  const upper = normalized.toUpperCase();
  const hasEpsg4326Authority = /AUTHORITY\s*\[\s*"EPSG"\s*,\s*"4326"\s*\]/i.test(normalized);

  if (hasEpsg4326Authority || upper.includes("EPSG:4326")) {
    return;
  }

  if (upper.startsWith("PROJCS")) {
    throw new BadRequestException(GEOMETRY_UPLOAD_ERROR_MESSAGES.PROJECTION);
  }

  const isGeographicWgs84 =
    /GEOGCS\s*\[\s*"WGS\s*84"/i.test(normalized) || upper.includes("WGS_1984") || upper.includes("WGS84");

  if (!isGeographicWgs84) {
    throw new BadRequestException(GEOMETRY_UPLOAD_ERROR_MESSAGES.PROJECTION);
  }
}

export function validateParsedGeometryCollection(geojson: FeatureCollection): void {
  assertSingleGeometryCategory(geojson.features);
  assertTwoDimensionalCoordinates(geojson.features);
  assertWgs84Coordinates(geojson.features);
  assertValidLinearRings(geojson.features);
}

function assertSingleGeometryCategory(features: Feature[]): void {
  let hasPointGeometry = false;
  let hasPolygonGeometry = false;

  for (const feature of features) {
    const geometryType = feature.geometry?.type;
    if (geometryType == null) {
      continue;
    }

    if (POINT_GEOMETRY_TYPES.has(geometryType)) {
      hasPointGeometry = true;
    }
    if (POLYGON_GEOMETRY_TYPES.has(geometryType)) {
      hasPolygonGeometry = true;
    }
  }

  if (hasPointGeometry && hasPolygonGeometry) {
    throw new BadRequestException(GEOMETRY_UPLOAD_ERROR_MESSAGES.MIXED_GEOMETRY_TYPES);
  }
}

function assertTwoDimensionalCoordinates(features: Feature[]): void {
  for (const feature of features) {
    if (feature.geometry != null && geometryHas3DCoordinates(feature.geometry)) {
      throw new BadRequestException(GEOMETRY_UPLOAD_ERROR_MESSAGES.COORDINATE_3D);
    }
  }
}

function geometryHas3DCoordinates(geometry: Geometry): boolean {
  return collectPositions(geometry).some(hasNonZeroElevation);
}

function hasNonZeroElevation(position: Position): boolean {
  if (position.length <= 2) {
    return false;
  }

  const elevation = position[2];
  return elevation != null && elevation !== 0;
}

function collectPositions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "MultiPoint":
    case "LineString":
      return geometry.coordinates;
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    case "GeometryCollection":
      return geometry.geometries.flatMap(collectPositions);
    default:
      return [];
  }
}

function assertWgs84Coordinates(features: Feature[]): void {
  for (const feature of features) {
    if (feature.geometry == null) {
      continue;
    }

    for (const position of collectPositions(feature.geometry)) {
      const [longitude, latitude] = position;
      if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
        throw new BadRequestException(GEOMETRY_UPLOAD_ERROR_MESSAGES.PROJECTION);
      }
    }
  }
}

function assertValidLinearRings(features: Feature[]): void {
  for (const feature of features) {
    const geometry = feature.geometry;
    if (geometry == null) {
      continue;
    }

    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      if (!areLinearRingsValid(geometry)) {
        throw new BadRequestException(LINEAR_RING_ERROR_MESSAGE);
      }
    }
  }
}
