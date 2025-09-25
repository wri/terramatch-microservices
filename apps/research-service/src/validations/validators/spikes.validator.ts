import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";

interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

interface SpikeDetectionResult extends ValidationResult {
  extraInfo: {
    spikes: number[][];
    spikeCount: number;
  } | null;
}

export class SpikesValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<SpikeDetectionResult> {
    const geoJson = await PolygonGeometry.getGeoJSONParsed(polygonUuid);
    if (geoJson == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const spikes = this.detectSpikes(geoJson as GeoJSONGeometry);
    const valid = spikes.length === 0;

    return {
      valid,
      extraInfo: {
        spikes,
        spikeCount: spikes.length
      }
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const results = await PolygonGeometry.getGeoJSONBatchParsed(polygonUuids);
    const resultMap = new Map(results.map(r => [r.uuid, r.geoJson as GeoJSONGeometry]));

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
        valid,
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
