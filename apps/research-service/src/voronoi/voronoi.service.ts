import { Injectable, Logger } from "@nestjs/common";
// d3-delaunay is ESM; load it dynamically where needed to avoid CJS require issues
import proj4 from "proj4";
import * as turf from "@turf/turf";
import { Feature, Polygon } from "geojson";
import { Feature as RequestFeature } from "../site-polygons/dto/create-site-polygon-request.dto";

const WGS84_CRS = "EPSG:4326";
const BUFFER_ENVELOPE_SIZE = 5000;
const ADDITIONAL_RADIUS = 5;
const INTERSECTION_BUFFER = 0.0000009;

type Point = [number, number];

@Injectable()
export class VoronoiService {
  private readonly logger = new Logger(VoronoiService.name);

  // no-op: WGS84 buffers are created directly via turf.circle

  private calculateCircleRadius(hectaresArea: number, additionalRadius: number = ADDITIONAL_RADIUS): number {
    try {
      const squareMeters = hectaresArea * 10000;
      const radius = Math.sqrt(squareMeters / Math.PI);
      return radius + additionalRadius;
    } catch (error) {
      this.logger.error(`Error in calculateCircleRadius: ${error}`);
      return 0;
    }
  }

  private processFeatures(features: RequestFeature[]): {
    transformedPoints: Point[];
    bufferedPolygons: Feature<Polygon>[];
    toWGS84: proj4.Converter;
    toProjected: proj4.Converter;
  } {
    try {
      const points = features.map(f => {
        const coords = f.geometry.coordinates as number[];
        return [coords[0], coords[1]];
      });

      const centroidLon = points.reduce((sum, p) => sum + p[0], 0) / points.length;
      const centroidLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;

      const customProjection = `+proj=tmerc +lat_0=${centroidLat} +lon_0=${centroidLon} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;

      const toProjected = proj4(WGS84_CRS, customProjection);
      const toWGS84 = proj4(customProjection, WGS84_CRS);

      const transformedPoints: Point[] = [];
      const bufferedPolygons: Feature<Polygon>[] = [];
      let skippedInvalidProject = 0;
      let minBuffer = Number.POSITIVE_INFINITY;
      let maxBuffer = 0;

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const point = points[i];
        const properties = feature.properties ?? {};
        const estArea = (properties.est_area as number) ?? 0;

        const projectedPoint = toProjected.forward(point) as Point;

        if (!isFinite(projectedPoint[0]) || !isFinite(projectedPoint[1])) {
          skippedInvalidProject++;
          continue;
        }

        transformedPoints.push(projectedPoint);

        const bufferDistance = this.calculateCircleRadius(estArea);
        if (bufferDistance < minBuffer) minBuffer = bufferDistance;
        if (bufferDistance > maxBuffer) maxBuffer = bufferDistance;

        // Create buffer in WGS84 to match the original (working) implementation
        const wgs84Point = toWGS84.forward(projectedPoint);
        const bufferPolygon = turf.circle(turf.point(wgs84Point), bufferDistance / 1000, { units: "kilometers" });
        bufferedPolygons.push(bufferPolygon);
      }

      this.logger.log(
        `voronoi: proj_ok=${transformedPoints.length} proj_skip=${skippedInvalidProject} buffer_m_min=${
          isFinite(minBuffer) ? Math.round(minBuffer) : 0
        } buffer_m_max=${Math.round(maxBuffer)}`
      );
      return {
        transformedPoints,
        bufferedPolygons,
        toWGS84,
        toProjected
      };
    } catch (error) {
      this.logger.error(`Error in processFeatures: ${error}`);
      throw error;
    }
  }

  private async generateVoronoiPolygons(transformedPoints: Point[]): Promise<ReturnType<any["voronoi"]>> {
    try {
      // Use Function constructor to create a dynamic import that webpack won't process
      // This bypasses webpack's static analysis and uses Node.js native import at runtime
      const importDelaunay = new Function("return import('d3-delaunay')");
      const delaunayModule = await importDelaunay();
      const { Delaunay } = delaunayModule;
      const delaunay = Delaunay.from(transformedPoints);

      const xs = transformedPoints.map(p => p[0]);
      const ys = transformedPoints.map(p => p[1]);
      const xmin = Math.min(...xs) - BUFFER_ENVELOPE_SIZE;
      const xmax = Math.max(...xs) + BUFFER_ENVELOPE_SIZE;
      const ymin = Math.min(...ys) - BUFFER_ENVELOPE_SIZE;
      const ymax = Math.max(...ys) + BUFFER_ENVELOPE_SIZE;

      const voronoi = delaunay.voronoi([xmin, ymin, xmax, ymax]);

      return voronoi;
    } catch (error) {
      this.logger.error(`Error in generateVoronoiPolygons: ${error}`);
      throw error;
    }
  }

  private createOutputGeoJSON(
    features: RequestFeature[],
    transformedPoints: Point[],
    bufferedPolygons: Feature<Polygon>[],
    voronoi: any,
    toWGS84: proj4.Converter
  ): RequestFeature[] {
    try {
      const outputFeatures: RequestFeature[] = [];
      let skipNoCell = 0;
      let skipNoBuffer = 0;
      let skipIntersectNull = 0;
      let skipCleanedNull = 0;
      let skipIntersectError = 0;
      let skipFeatureError = 0;
      const usedVoronoiFallback = 0;

      for (let i = 0; i < transformedPoints.length; i++) {
        try {
          const cell = voronoi.cellPolygon(i);

          if (cell == null || cell.length < 3) {
            skipNoCell++;
            continue;
          }

          // Convert Voronoi cell back to WGS84 for intersection with WGS84 buffers
          const projectedCell = cell as Point[];
          const wgs84Cell = projectedCell.map(coord => toWGS84.forward(coord) as Point);

          // Close the ring by adding the first point at the end
          const closedRing = wgs84Cell.concat([wgs84Cell[0]]);
          const voronoiPolygon = turf.polygon([closedRing]);

          // Validate the created polygon
          if (
            voronoiPolygon == null ||
            voronoiPolygon.geometry == null ||
            voronoiPolygon.geometry.coordinates == null
          ) {
            skipNoCell++;
            continue;
          }

          const bufferFeature = bufferedPolygons[i];

          if (bufferFeature == null) {
            skipNoBuffer++;
            continue;
          }

          // Validate buffer feature
          if (bufferFeature.geometry == null || bufferFeature.geometry.coordinates == null) {
            skipNoBuffer++;
            continue;
          }

          let intersection;
          try {
            // Turf.js 7.x requires intersect to be called with a FeatureCollection
            // Version 6.x used separate arguments (poly1, poly2)
            // Version 7.0+ requires turf.featureCollection([poly1, poly2])
            const featureCollection = turf.featureCollection([voronoiPolygon, bufferFeature]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            intersection = (turf as any).intersect(featureCollection);
          } catch (_e) {
            const msg = (_e as Error)?.message ?? "unknown";
            this.logger.warn(`voronoi: intersect_err i=${i} msg=${msg}`);
            skipIntersectError++;
            // Do not fallback to raw Voronoi; skip to maintain circular clipping
            continue;
          }

          if (intersection == null || intersection.geometry.coordinates.length === 0) {
            skipIntersectNull++;
            continue;
          }

          let cleanedIntersection;
          try {
            // Apply tiny cleanup in projected units (meters)
            cleanedIntersection = turf.buffer(intersection, -0.1, { units: "meters" });
          } catch {
            cleanedIntersection = intersection;
          }

          if (cleanedIntersection == null) {
            skipCleanedNull++;
            continue;
          }

          // Intersection already in WGS84
          const outputFeature: RequestFeature = {
            type: "Feature",
            geometry: {
              type: cleanedIntersection.geometry.type as "Polygon" | "MultiPolygon",
              coordinates: cleanedIntersection.geometry.coordinates as number[][][] | number[][][][]
            },
            properties: features[i].properties ?? {}
          };

          outputFeatures.push(outputFeature);
        } catch (_featureError) {
          skipFeatureError++;
          continue;
        }
      }

      this.logger.log(
        `voronoi: out=${outputFeatures.length} skip_no_cell=${skipNoCell} skip_no_buffer=${skipNoBuffer} skip_no_intersect=${skipIntersectNull} skip_cleaned_null=${skipCleanedNull} skip_intersect_err=${skipIntersectError} skip_feat_err=${skipFeatureError} voronoi_fallback=${usedVoronoiFallback}`
      );
      return outputFeatures;
    } catch (error) {
      this.logger.error(`Error in createOutputGeoJSON: ${error}`);
      throw error;
    }
  }

  async transformPointsToPolygons(points: RequestFeature[]): Promise<RequestFeature[]> {
    try {
      if (points.length === 0) {
        return [];
      }

      this.logger.log(`voronoi: points_in=${points.length}`);

      const { transformedPoints, bufferedPolygons, toWGS84 } = this.processFeatures(points);

      this.logger.log(
        `voronoi: transformed_points=${transformedPoints.length} buffered_polygons=${bufferedPolygons.length}`
      );

      if (transformedPoints.length === 0) {
        return [];
      }

      const voronoi = await this.generateVoronoiPolygons(transformedPoints);

      const outputFeatures = this.createOutputGeoJSON(points, transformedPoints, bufferedPolygons, voronoi, toWGS84);
      this.logger.log(`voronoi: polygons_out=${outputFeatures.length}`);
      return outputFeatures;
    } catch (error) {
      this.logger.error(`Error in transformPointsToPolygons: ${error}`);
      throw error;
    }
  }
}
