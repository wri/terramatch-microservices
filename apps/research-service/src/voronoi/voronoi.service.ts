import { Injectable, Logger } from "@nestjs/common";
import { Delaunay } from "d3-delaunay";
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

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const point = points[i];
        const properties = feature.properties ?? {};
        const estArea = (properties.est_area as number) ?? 0;

        const projectedPoint = toProjected.forward(point) as Point;

        if (!isFinite(projectedPoint[0]) || !isFinite(projectedPoint[1])) {
          continue;
        }

        transformedPoints.push(projectedPoint);

        const bufferDistance = this.calculateCircleRadius(estArea);

        const wgs84Point = toWGS84.forward(projectedPoint);
        const bufferPolygon = turf.circle(turf.point(wgs84Point), bufferDistance / 1000, { units: "kilometers" });

        bufferedPolygons.push(bufferPolygon);
      }

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

  private generateVoronoiPolygons(transformedPoints: Point[]): ReturnType<Delaunay<Point>["voronoi"]> {
    try {
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
    voronoi: ReturnType<Delaunay<Point>["voronoi"]>,
    toWGS84: proj4.Converter
  ): RequestFeature[] {
    try {
      const outputFeatures: RequestFeature[] = [];

      for (let i = 0; i < transformedPoints.length; i++) {
        try {
          const cell = voronoi.cellPolygon(i);

          if (cell == null || cell.length < 3) {
            continue;
          }

          const wgs84Cell = cell.map(coord => toWGS84.forward(coord) as Point);
          const voronoiPolygon = turf.polygon([wgs84Cell.concat([wgs84Cell[0]])]);

          const bufferFeature = bufferedPolygons[i];

          if (bufferFeature == null) {
            continue;
          }

          let intersection;
          try {
            if (voronoiPolygon == null || bufferFeature == null) {
              continue;
            }

            // @ts-expect-error - turf.intersect type definitions are incorrect, runtime works correctly
            intersection = turf.intersect(voronoiPolygon, bufferFeature);
          } catch {
            continue;
          }

          if (intersection == null || intersection.geometry.coordinates.length === 0) {
            continue;
          }

          let cleanedIntersection;
          try {
            cleanedIntersection = turf.buffer(intersection, -INTERSECTION_BUFFER, { units: "degrees" });
          } catch {
            cleanedIntersection = intersection;
          }

          if (cleanedIntersection == null) {
            continue;
          }

          const outputFeature: RequestFeature = {
            type: "Feature",
            geometry: {
              type: cleanedIntersection.geometry.type as "Polygon" | "MultiPolygon",
              coordinates: cleanedIntersection.geometry.coordinates as number[][][] | number[][][][]
            },
            properties: features[i].properties ?? {}
          };

          outputFeatures.push(outputFeature);
        } catch (featureError) {
          this.logger.error(`Error processing feature ${i}: ${(featureError as Error).message}`);
          continue;
        }
      }

      return outputFeatures;
    } catch (error) {
      this.logger.error(`Error in createOutputGeoJSON: ${error}`);
      throw error;
    }
  }

  transformPointsToPolygons(points: RequestFeature[]): RequestFeature[] {
    try {
      if (points.length === 0) {
        return [];
      }

      this.logger.log(`Processing ${points.length} points for Voronoi transformation`);

      const { transformedPoints, bufferedPolygons, toWGS84 } = this.processFeatures(points);

      if (transformedPoints.length === 0) {
        return [];
      }

      const voronoi = this.generateVoronoiPolygons(transformedPoints);

      const outputFeatures = this.createOutputGeoJSON(points, transformedPoints, bufferedPolygons, voronoi, toWGS84);

      this.logger.log(`Successfully transformed ${outputFeatures.length} points to polygons`);
      return outputFeatures;
    } catch (error) {
      this.logger.error(`Error in transformPointsToPolygons: ${error}`);
      throw error;
    }
  }
}
