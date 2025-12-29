import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Feature, FeatureCollection, Geometry, Point, Polygon, MultiPolygon } from "geojson";
import * as turf from "@turf/turf";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { QueryTypes, Transaction } from "sequelize";
import { VoronoiService } from "../voronoi/voronoi.service";
import { Feature as RequestFeature } from "../site-polygons/dto/create-site-polygon-request.dto";

const DEFAULT_EST_AREA_HECTARES = 78;
const ADDITIONAL_RADIUS_METERS = 5;

@Injectable()
export class ProjectPolygonGeometryService {
  constructor(private readonly voronoiService: VoronoiService) {}

  async transformFeaturesToSinglePolygon(featureCollection: FeatureCollection): Promise<Geometry> {
    const features = featureCollection.features;

    if (features.length === 0) {
      throw new InternalServerErrorException("No features to transform");
    }

    const allPoints = this.areAllPoints(features);

    if (allPoints) {
      if (features.length === 1) {
        return this.bufferSinglePoint(features[0]);
      }

      return this.transformPointsViaVoronoi(features);
    }

    if (features.length === 1) {
      return features[0].geometry;
    }

    return this.computeConvexHull(features);
  }

  private areAllPoints(features: Feature[]): boolean {
    return features.every(f => f.geometry.type === "Point");
  }

  private calculateCircleRadiusMeters(hectaresArea: number): number {
    const squareMeters = hectaresArea * 10000;
    const radius = Math.sqrt(squareMeters / Math.PI);
    return radius + ADDITIONAL_RADIUS_METERS;
  }

  private bufferSinglePoint(feature: Feature): Polygon {
    const point = feature.geometry as Point;
    const estArea =
      (feature.properties?.estArea as number) ?? (feature.properties?.est_area as number) ?? DEFAULT_EST_AREA_HECTARES;

    const radiusMeters = this.calculateCircleRadiusMeters(estArea);
    const radiusKm = radiusMeters / 1000;

    const buffered = turf.circle(turf.point(point.coordinates), radiusKm, { units: "kilometers" });

    return buffered.geometry;
  }

  private async transformPointsViaVoronoi(features: Feature[]): Promise<Polygon> {
    const requestFeatures: RequestFeature[] = features.map(f => {
      const props = f.properties ?? {};
      const estArea = (props.estArea as number) ?? (props.est_area as number) ?? DEFAULT_EST_AREA_HECTARES;

      return {
        type: "Feature" as const,
        geometry: {
          type: f.geometry.type as "Point",
          coordinates: (f.geometry as Point).coordinates
        },
        properties: {
          ...props,
          est_area: estArea
        }
      };
    });

    const voronoiPolygons = await this.voronoiService.transformPointsToPolygons(requestFeatures);

    if (voronoiPolygons.length === 0) {
      return this.computeConvexHull(features);
    }

    const voronoiFeatures: Feature[] = voronoiPolygons.map(vp => ({
      type: "Feature" as const,
      geometry: vp.geometry as Polygon | MultiPolygon,
      properties: vp.properties ?? {}
    }));

    return this.computeConvexHull(voronoiFeatures);
  }

  async computeConvexHull(features: Feature[], transaction?: Transaction): Promise<Polygon> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (features.length === 0) {
      throw new InternalServerErrorException("No features provided for convex hull");
    }

    if (features.length === 1) {
      const singleGeom = features[0].geometry;
      if (singleGeom.type === "Polygon") {
        return singleGeom;
      }
    }

    const featureCollection: FeatureCollection = {
      type: "FeatureCollection",
      features
    };

    const geoJsonString = JSON.stringify(featureCollection);

    const query = `
      SELECT ST_AsGeoJSON(
        ST_ConvexHull(ST_GeomFromGeoJSON(:geojson))
      ) as convex_hull
    `;

    const results = (await PolygonGeometry.sequelize.query(query, {
      replacements: { geojson: geoJsonString },
      type: QueryTypes.SELECT,
      transaction
    })) as Array<{ convex_hull: string }>;

    if (results.length === 0 || results[0].convex_hull == null) {
      throw new InternalServerErrorException("Failed to compute convex hull");
    }

    return JSON.parse(results[0].convex_hull) as Polygon;
  }
}
