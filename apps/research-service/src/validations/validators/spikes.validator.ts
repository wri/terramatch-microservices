import { Injectable } from "@nestjs/common";
import { QueryTypes } from "sequelize";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";

interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

interface SpikeDetectionResult {
  valid: boolean;
  extraInfo: {
    spikes: number[][];
    spikeCount: number;
  } | null;
}

@Injectable()
export class SpikesValidator {
  async validatePolygon(polygonUuid: string): Promise<SpikeDetectionResult> {
    if (PolygonGeometry.sequelize == null) {
      throw new Error("PolygonGeometry model is missing sequelize connection");
    }

    const result = await PolygonGeometry.sequelize.query(
      `
        SELECT ST_AsGeoJSON(geom) as geo_json
        FROM polygon_geometry 
        WHERE uuid = :polygonUuid
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT
      }
    );

    if (result.length === 0) {
      throw new Error(`Polygon with UUID ${polygonUuid} not found`);
    }

    const geoJson = JSON.parse((result[0] as { geo_json: string }).geo_json) as GeoJSONGeometry;
    const spikes = this.detectSpikes(geoJson);
    const valid = spikes.length === 0;

    return {
      valid: Boolean(valid),
      extraInfo: {
        spikes,
        spikeCount: spikes.length
      }
    };
  }

  async validatePolygons(
    polygonUuids: string[]
  ): Promise<Array<{ polygonUuid: string; valid: boolean; extraInfo: object | null }>> {
    if (PolygonGeometry.sequelize == null) {
      throw new Error("PolygonGeometry model is missing sequelize connection");
    }

    const results = await PolygonGeometry.sequelize.query(
      `
        SELECT uuid, ST_AsGeoJSON(geom) as geo_json
        FROM polygon_geometry 
        WHERE uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT
      }
    );

    const resultMap = new Map(
      (results as Array<{ uuid: string; geo_json: string }>).map(r => [
        r.uuid,
        JSON.parse(r.geo_json) as GeoJSONGeometry
      ])
    );

    return polygonUuids.map(polygonUuid => {
      const geoJson = resultMap.get(polygonUuid);
      if (geoJson == null || geoJson == undefined) {
        return {
          polygonUuid,
          valid: false,
          extraInfo: { error: "Polygon not found" }
        };
      }

      const spikes = this.detectSpikes(geoJson);
      const valid = spikes.length === 0;

      return {
        polygonUuid,
        valid: Boolean(valid),
        extraInfo: {
          spikes,
          spikeCount: spikes.length
        }
      };
    });
  }

  private detectSpikes(geometry: GeoJSONGeometry): number[][] {
    const spikes: number[][] = [];

    if (geometry.type == "Polygon" || geometry.type == "MultiPolygon") {
      const coordinates = geometry.type == "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0][0];

      const numVertices = coordinates.length;
      let totalDistance = 0;

      for (let i = 0; i < numVertices - 1; i++) {
        totalDistance += this.calculateDistance(coordinates[i], coordinates[i + 1]);
      }

      for (let i = 0; i < numVertices - 1; i++) {
        const distance1 = this.calculateDistance(coordinates[i], coordinates[(i + 1) % numVertices]);
        const distance2 = this.calculateDistance(
          coordinates[(i + 1) % numVertices],
          coordinates[(i + 2) % numVertices]
        );
        const combinedDistance = distance1 + distance2;

        if (combinedDistance > 0.6 * totalDistance) {
          spikes.push(coordinates[(i + 1) % numVertices]);
        }
      }
    }

    return spikes;
  }

  private calculateDistance(point1: number[], point2: number[]): number {
    const lat1 = point1[1];
    const lon1 = point1[0];
    const lat2 = point2[1];
    const lon2 = point2[0];

    const theta = lon1 - lon2;
    const dist =
      Math.sin(this.deg2rad(lat1)) * Math.sin(this.deg2rad(lat2)) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.cos(this.deg2rad(theta));
    const acosDist = Math.acos(dist);
    const rad2degDist = this.rad2deg(acosDist);
    const miles = rad2degDist * 60 * 1.1515;

    return miles * 1.609344;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private rad2deg(rad: number): number {
    return rad * (180 / Math.PI);
  }
}
