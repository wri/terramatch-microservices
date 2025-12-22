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
  private delaunayModulePromise: Promise<typeof import("d3-delaunay")> | null = null;

  private async getDelaunayModule(): Promise<typeof import("d3-delaunay")> {
    if (this.delaunayModulePromise == null) {
      const moduleName = "d3-delaunay";
      const importFn = new Function("moduleName", "return import(moduleName)");
      this.delaunayModulePromise = importFn(moduleName) as Promise<typeof import("d3-delaunay")>;
    }
    return this.delaunayModulePromise;
  }

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
    validFeatureIndices: number[];
    toWGS84: proj4.Converter;
    toProjected: proj4.Converter;
  } {
    let centroidLonSum = 0;
    let centroidLatSum = 0;
    const points: Point[] = [];

    for (let i = 0; i < features.length; i++) {
      const coords = features[i].geometry.coordinates as number[];
      const point: Point = [coords[0], coords[1]];
      points.push(point);
      centroidLonSum += point[0];
      centroidLatSum += point[1];
    }

    const centroidLon = centroidLonSum / features.length;
    const centroidLat = centroidLatSum / features.length;

    const customProjection = `+proj=tmerc +lat_0=${centroidLat} +lon_0=${centroidLon} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;

    const toProjected = proj4(WGS84_CRS, customProjection);
    const toWGS84 = proj4(customProjection, WGS84_CRS);

    const transformedPoints: Point[] = [];
    const bufferedPolygons: Feature<Polygon>[] = [];
    const validFeatureIndices: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const point = points[i];
      const properties = feature.properties ?? {};
      const estArea = (properties.estArea as number) ?? (properties.est_area as number) ?? 0;

      const projectedPoint = toProjected.forward(point) as Point;

      if (!isFinite(projectedPoint[0]) || !isFinite(projectedPoint[1])) {
        continue;
      }

      transformedPoints.push(projectedPoint);
      validFeatureIndices.push(i);

      const bufferDistance = this.calculateCircleRadius(estArea);

      const wgs84Point = toWGS84.forward(projectedPoint);
      const bufferPolygon = turf.circle(turf.point(wgs84Point), bufferDistance / 1000, { units: "kilometers" });
      bufferedPolygons.push(bufferPolygon);
    }

    return {
      transformedPoints,
      bufferedPolygons,
      validFeatureIndices,
      toWGS84,
      toProjected
    };
  }

  private async generateVoronoiPolygons(transformedPoints: Point[]): Promise<Voronoi<Point>> {
    const delaunayModule = await this.getDelaunayModule();
    const delaunay = delaunayModule.Delaunay.from(transformedPoints);

    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;

    for (let i = 0; i < transformedPoints.length; i++) {
      const [x, y] = transformedPoints[i];
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }

    xmin -= BUFFER_ENVELOPE_SIZE;
    xmax += BUFFER_ENVELOPE_SIZE;
    ymin -= BUFFER_ENVELOPE_SIZE;
    ymax += BUFFER_ENVELOPE_SIZE;

    return delaunay.voronoi([xmin, ymin, xmax, ymax]);
  }

  private createOutputGeoJSON(
    features: RequestFeature[],
    transformedPoints: Point[],
    bufferedPolygons: Feature<Polygon>[],
    validFeatureIndices: number[],
    voronoi: Voronoi<Point>,
    toWGS84: proj4.Converter
  ): RequestFeature[] {
    const outputFeatures: RequestFeature[] = [];
    outputFeatures.length = 0;

    for (let i = 0; i < transformedPoints.length; i++) {
      const originalFeatureIndex = validFeatureIndices[i];
      const bufferFeature = bufferedPolygons[i];

      if (bufferFeature == null || bufferFeature.geometry == null || bufferFeature.geometry.coordinates == null) {
        continue;
      }

      try {
        const cell = voronoi.cellPolygon(i);

        if (cell == null || cell.length < 3) {
          continue;
        }

        const projectedCell = cell as Point[];
        const wgs84Cell: Point[] = [];
        for (let j = 0; j < projectedCell.length; j++) {
          wgs84Cell[j] = toWGS84.forward(projectedCell[j]) as Point;
        }

        const closedRing = [...wgs84Cell, wgs84Cell[0]];
        const voronoiPolygon = turf.polygon([closedRing]);

        if (voronoiPolygon == null || voronoiPolygon.geometry == null || voronoiPolygon.geometry.coordinates == null) {
          continue;
        }

        let intersection: Feature<Polygon> | null = null;
        try {
          const featureCollection = turf.featureCollection([voronoiPolygon, bufferFeature]);
          intersection = (
            turf.intersect as (featureCollection: ReturnType<typeof turf.featureCollection>) => Feature<Polygon> | null
          )(featureCollection);
        } catch {
          continue;
        }

        if (intersection == null || intersection.geometry.coordinates.length === 0) {
          continue;
        }

        let cleanedIntersection: Feature<Polygon>;
        try {
          const buffered = turf.buffer(intersection, -0.1, { units: "meters" });
          cleanedIntersection = (buffered != null ? buffered : intersection) as Feature<Polygon>;
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
          properties: features[originalFeatureIndex].properties ?? {}
        };

        outputFeatures.push(outputFeature);
      } catch {
        // NOOP
      }
    }

    return outputFeatures;
  }

  async transformPointsToPolygons(points: RequestFeature[]): Promise<RequestFeature[]> {
    if (points.length === 0) {
      return [];
    }

    const { transformedPoints, bufferedPolygons, validFeatureIndices, toWGS84 } = this.processFeatures(points);

    if (transformedPoints.length === 0) {
      return [];
    }

    const voronoi = await this.generateVoronoiPolygons(transformedPoints);

    return this.createOutputGeoJSON(points, transformedPoints, bufferedPolygons, validFeatureIndices, voronoi, toWGS84);
  }
}
