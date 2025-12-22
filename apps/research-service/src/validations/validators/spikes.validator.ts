import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { PolygonValidator, GeometryValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Geometry } from "geojson";

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
    spike_count: number;
  } | null;
}

export class SpikesValidator implements PolygonValidator, GeometryValidator {
  private readonly SPIKE_ANGLE_THRESHOLD = 10;

  private readonly SPIKE_RATIO_THRESHOLD = 5;

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
        spike_count: spikes.length
      }
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const results = await PolygonGeometry.getGeoJSONBatchParsed(polygonUuids);
    const resultMap = new Map(results.map(r => [r.uuid, r.geoJson as GeoJSONGeometry]));

    return polygonUuids.map(polygonUuid => {
      const geoJson = resultMap.get(polygonUuid);
      if (geoJson == null) {
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
          spike_count: spikes.length
        }
      };
    });
  }

  async validateGeometry(geometry: Geometry): Promise<SpikeDetectionResult> {
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      return {
        valid: true,
        extraInfo: null
      };
    }

    const spikes = this.detectSpikes(geometry as GeoJSONGeometry);
    const valid = spikes.length === 0;

    return {
      valid,
      extraInfo: {
        spikes,
        spike_count: spikes.length
      }
    };
  }

  private detectSpikes(geometry: GeoJSONGeometry): number[][] {
    const spikes: number[][] = [];

    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) {
        spikes.push(...this.detectSpikesInRing(ring));
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          spikes.push(...this.detectSpikesInRing(ring));
        }
      }
    }

    return spikes;
  }

  private detectSpikesInRing(coordinates: number[][]): number[][] {
    const spikes: number[][] = [];
    const n = coordinates.length;

    if (n < 4) return spikes;

    for (let i = 1; i < n - 1; i++) {
      const prev = coordinates[i - 1];
      const current = coordinates[i];
      const next = coordinates[i + 1];

      const angle = this.calculateAngle(prev, current, next);

      const d1 = this.calculateDistance(prev, current);
      const d2 = this.calculateDistance(current, next);
      const baseDistance = this.calculateDistance(prev, next);

      const isSharpAngle = angle < this.SPIKE_ANGLE_THRESHOLD;
      const isSkinny = baseDistance > 0 && (d1 + d2) / baseDistance > this.SPIKE_RATIO_THRESHOLD;

      if (isSharpAngle && isSkinny) {
        spikes.push(current);
      }
    }

    return spikes;
  }

  private calculateAngle(p1: number[], p2: number[], p3: number[]): number {
    const v1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const v2 = [p3[0] - p2[0], p3[1] - p2[1]];

    const dot = v1[0] * v2[0] + v1[1] * v2[1];

    const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);

    if (mag1 === 0 || mag2 === 0) return 180;

    const cosAngle = dot / (mag1 * mag2);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    const angleRad = Math.acos(clampedCos);
    return angleRad * (180 / Math.PI);
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

    const clampedDist = Math.max(-1, Math.min(1, dist));
    const acosDist = Math.acos(clampedDist);
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
