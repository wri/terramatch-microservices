import { Injectable } from "@nestjs/common";
import proj4 from "proj4";
import * as turf from "@turf/turf";
import { Feature, Polygon } from "geojson";
import { Feature as RequestFeature } from "../site-polygons/dto/create-site-polygon-request.dto";
import type { Voronoi } from "d3-delaunay";

const WGS84_CRS = "EPSG:4326";
const BUFFER_ENVELOPE_SIZE = 5000;
const ADDITIONAL_RADIUS = 5;

type Point = [number, number];

@Injectable()
export class VoronoiService {
  private calculateCircleRadius(hectaresArea: number, additionalRadius: number = ADDITIONAL_RADIUS): number {
    try {
      const squareMeters = hectaresArea * 10000;
      const radius = Math.sqrt(squareMeters / Math.PI);
      return radius + additionalRadius;
    } catch {
      return 0;
    }
  }

  private processFeatures(features: RequestFeature[]): {
    transformedPoints: Point[];
    bufferedPolygons: Feature<Polygon>[];
    toWGS84: proj4.Converter;
    toProjected: proj4.Converter;
  } {
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

      // Create buffer in WGS84 to match the original (working) implementation
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
  }

  private async generateVoronoiPolygons(transformedPoints: Point[]): Promise<Voronoi<Point>> {
    const loadDelaunay = new Function("return import('d3-delaunay')");
    const delaunayModule = await loadDelaunay();
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
  }

  private createOutputGeoJSON(
    features: RequestFeature[],
    transformedPoints: Point[],
    bufferedPolygons: Feature<Polygon>[],
    voronoi: Voronoi<Point>,
    toWGS84: proj4.Converter
  ): RequestFeature[] {
    const outputFeatures: RequestFeature[] = [];

    for (let i = 0; i < transformedPoints.length; i++) {
      try {
        const cell = voronoi.cellPolygon(i);

        if (cell == null || cell.length < 3) {
          continue;
        }

        // Convert Voronoi cell back to WGS84 for intersection with WGS84 buffers
        const projectedCell = cell as Point[];
        const wgs84Cell = projectedCell.map(coord => toWGS84.forward(coord) as Point);

        // Close the ring by adding the first point at the end
        const closedRing = wgs84Cell.concat([wgs84Cell[0]]);
        const voronoiPolygon = turf.polygon([closedRing]);

        // Validate the created polygon
        if (voronoiPolygon == null || voronoiPolygon.geometry == null || voronoiPolygon.geometry.coordinates == null) {
          continue;
        }

        const bufferFeature = bufferedPolygons[i];

        if (bufferFeature == null) {
          continue;
        }

        // Validate buffer feature
        if (bufferFeature.geometry == null || bufferFeature.geometry.coordinates == null) {
          continue;
        }

        let intersection;
        try {
          // Turf.js 7.x requires intersect to be called with a FeatureCollection
          // Version 6.x used separate arguments (poly1, poly2)
          // Version 7.0+ requires turf.featureCollection([poly1, poly2])
          const featureCollection = turf.featureCollection([voronoiPolygon, bufferFeature]);
          // Turf.js types may not match the runtime API, using type assertion for intersect
          intersection = (
            turf.intersect as (featureCollection: ReturnType<typeof turf.featureCollection>) => Feature<Polygon> | null
          )(featureCollection);
        } catch {
          // Do not fallback to raw Voronoi; skip to maintain circular clipping
          continue;
        }

        if (intersection == null || intersection.geometry.coordinates.length === 0) {
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
      } catch {
        continue;
      }
    }

    return outputFeatures;
  }

  async transformPointsToPolygons(points: RequestFeature[]): Promise<RequestFeature[]> {
    if (points.length === 0) {
      return [];
    }

    const { transformedPoints, bufferedPolygons, toWGS84 } = this.processFeatures(points);

    if (transformedPoints.length === 0) {
      return [];
    }

    const voronoi = await this.generateVoronoiPolygons(transformedPoints);

    const outputFeatures = this.createOutputGeoJSON(points, transformedPoints, bufferedPolygons, voronoi, toWGS84);
    return outputFeatures;
  }
}
