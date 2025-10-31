import * as turf from "@turf/turf";
import proj4 from "proj4";
import { Feature, Geometry, Polygon, MultiPolygon } from "geojson";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsts = require("jsts");
import { Logger } from "@nestjs/common";

// Access JSTS classes from the bundle (they're on the global jsts object after require)
const GeoJSONReader = jsts.io.GeoJSONReader;
const GeoJSONWriter = jsts.io.GeoJSONWriter;
const IsValidOp = jsts.operation.valid.IsValidOp;
const BufferOp = jsts.operation.buffer.BufferOp;
const OverlayOp = jsts.operation.overlay.OverlayOp;
const GeometryFactory = jsts.geom.GeometryFactory;

const logger = new Logger("GeometryHelper");

// WGS84 CRS definition
const WGS84_CRS = "EPSG:4326";

// Shared JSTS GeometryFactory instance
const geometryFactory = new GeometryFactory();

/**
 * Convert square meters to hectares
 */
export function m2ToHectare(meterSquare: number): number {
  return meterSquare / 10000;
}

/**
 * Calculate the area of a geometry in hectares using WGS84 coordinates
 * Transforms to a local Transverse Mercator projection for accurate area calculation
 */
export function shapeHectaresFromWGS84(geom: Feature<Polygon | MultiPolygon>, featureIndex?: number): number {
  try {
    const center = turf.center(geom);
    const [lon, lat] = center.geometry.coordinates;

    // Create Transverse Mercator projection centered on the geometry
    const projStr = `+ellps=WGS84 +proj=tmerc +lon_0=${lon} +lat_0=${lat} +k=1 +x_0=0 +y_0=0`;

    // Transform geometry to projected CRS
    const transformedGeom = transformGeometry(geom, WGS84_CRS, projStr);

    if (transformedGeom === null) {
      logger.warn(
        `Failed to transform geometry${
          featureIndex !== undefined ? ` for feature ${featureIndex}` : ""
        }. Using envelope area.`
      );
      const bbox = turf.bbox(geom);
      const bboxPolygon = turf.bboxPolygon(bbox);
      const bboxTransformed = transformGeometry(bboxPolygon, WGS84_CRS, projStr);
      if (bboxTransformed === null) return 0;
      const area = turf.area(bboxTransformed);
      return m2ToHectare(area);
    }

    const area = turf.area(transformedGeom);

    if (!isFinite(area)) {
      logger.warn(
        `Invalid geometry found${featureIndex !== undefined ? ` in feature ${featureIndex}` : ""}. Attempting to fix.`
      );
      const bbox = turf.bbox(geom);
      const bboxPolygon = turf.bboxPolygon(bbox);
      const bboxTransformed = transformGeometry(bboxPolygon, WGS84_CRS, projStr);
      if (bboxTransformed === null) return 0;
      const bboxArea = turf.area(bboxTransformed);
      return m2ToHectare(bboxArea);
    }

    return m2ToHectare(area);
  } catch (error) {
    logger.warn(
      `Error in shapeHectaresFromWGS84${featureIndex !== undefined ? ` for feature ${featureIndex}` : ""}: ${error}`
    );
    return 0;
  }
}

/**
 * Transform a geometry from one CRS to another
 */
function transformGeometry(
  geom: Feature<Polygon | MultiPolygon>,
  fromCrs: string,
  toCrs: string
): Feature<Polygon | MultiPolygon> | null {
  try {
    const transformed = turf.clone(geom);
    const coordsTransformer = proj4(fromCrs, toCrs);

    if (transformed.geometry.type === "Polygon") {
      transformed.geometry.coordinates = transformed.geometry.coordinates.map(ring =>
        ring.map(coord => coordsTransformer.forward(coord))
      );
    } else if (transformed.geometry.type === "MultiPolygon") {
      transformed.geometry.coordinates = transformed.geometry.coordinates.map(polygon =>
        polygon.map(ring => ring.map(coord => coordsTransformer.forward(coord)))
      );
    }

    return transformed;
  } catch (error) {
    logger.warn(`Error transforming geometry: ${error}`);
    return null;
  }
}

/**
 * Validate and fix a geometry using JSTS
 * Similar to Shapely's make_valid()
 */
export function makeValid(geometry: Geometry): Geometry | null {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const writer = new GeoJSONWriter();

    const jstsGeom = reader.read(geometry);

    // Check if geometry is valid
    const isValidOp = new IsValidOp(jstsGeom);
    if (isValidOp.isValid() === true) {
      return geometry;
    }

    logger.warn("Invalid geometry detected, attempting to fix...");

    // Try to fix by buffering with 0
    const buffered = BufferOp.bufferOp(jstsGeom, 0);

    if (buffered !== null && buffered !== undefined && buffered.isValid() === true) {
      const fixed = writer.write(buffered);
      return fixed as Geometry;
    }

    logger.warn("Unable to fix invalid geometry");
    return null;
  } catch (error) {
    logger.warn(`Error in makeValid: ${error}`);
    return null;
  }
}

/**
 * Check if two geometries intersect
 */
export function geometryIntersects(geom1: Geometry, geom2: Geometry): boolean {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const jstsGeom1 = reader.read(geom1);
    const jstsGeom2 = reader.read(geom2);
    return jstsGeom1.intersects(jstsGeom2);
  } catch (error) {
    logger.warn(`Error checking intersection: ${error}`);
    return false;
  }
}

/**
 * Calculate the intersection of two geometries
 */
export function geometryIntersection(geom1: Geometry, geom2: Geometry): Geometry | null {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const writer = new GeoJSONWriter();

    const jstsGeom1 = reader.read(geom1);
    const jstsGeom2 = reader.read(geom2);

    const intersection = OverlayOp.intersection(jstsGeom1, jstsGeom2);

    if (
      intersection !== null &&
      intersection !== undefined &&
      intersection.isEmpty() === false &&
      intersection.isValid() === true
    ) {
      const result = writer.write(intersection);
      return result as Geometry;
    }

    return null;
  } catch (error) {
    logger.warn(`Error calculating intersection: ${error}`);
    return null;
  }
}

/**
 * Calculate the difference between two geometries (geom1 - geom2)
 * Similar to Shapely's difference operation
 */
export function geometryDifference(geom1: Geometry, geom2: Geometry): Geometry | null {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const writer = new GeoJSONWriter();

    const jstsGeom1 = reader.read(geom1);
    const jstsGeom2 = reader.read(geom2);

    const difference = OverlayOp.difference(jstsGeom1, jstsGeom2);

    if (
      difference !== null &&
      difference !== undefined &&
      difference.isEmpty() === false &&
      difference.isValid() === true
    ) {
      const result = writer.write(difference);
      return result as Geometry;
    }

    return null;
  } catch (error) {
    logger.warn(`Error calculating difference: ${error}`);
    return null;
  }
}

/**
 * Buffer a geometry by a distance
 * Distance in degrees for WGS84
 */
export function bufferGeometry(geometry: Geometry, distance: number): Geometry | null {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const writer = new GeoJSONWriter();

    const jstsGeom = reader.read(geometry);
    const buffered = BufferOp.bufferOp(jstsGeom, distance);

    if (buffered !== null && buffered !== undefined && buffered.isValid() === true) {
      const result = writer.write(buffered);
      return result as Geometry;
    }

    return null;
  } catch (error) {
    logger.warn(`Error buffering geometry: ${error}`);
    return null;
  }
}

/**
 * Simplify a geometry
 * Note: tolerance parameter is not used in current implementation
 */
export function simplifyGeometry(geometry: Geometry): Geometry | null {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const writer = new GeoJSONWriter();

    const jstsGeom = reader.read(geometry);
    const simplified = jstsGeom.buffer(0).buffer(0); // Simple approach to clean geometry

    if (simplified !== null && simplified !== undefined && simplified.isValid() === true) {
      const result = writer.write(simplified);
      return result as Geometry;
    }

    return null;
  } catch (error) {
    logger.warn(`Error simplifying geometry: ${error}`);
    return null;
  }
}

/**
 * Calculate the area of a geometry in square degrees
 */
export function geometryArea(geometry: Geometry): number {
  try {
    const reader = new GeoJSONReader(geometryFactory);
    const jstsGeom = reader.read(geometry);
    return jstsGeom.getArea();
  } catch (error) {
    logger.warn(`Error calculating geometry area: ${error}`);
    return 0;
  }
}
