import { GeometryValidator, ValidationResult } from "./validator.interface";
import { Geometry, Polygon, MultiPolygon, Point } from "geojson";

interface FeatureBoundsValidationResult extends ValidationResult {
  extraInfo: {
    invalidCoordinates: Array<{
      longitude: number;
      latitude: number;
      reason: string;
    }>;
  } | null;
}

export class FeatureBoundsValidator implements GeometryValidator {
  async validateGeometry(geometry: Geometry): Promise<FeatureBoundsValidationResult> {
    const invalidCoordinates: Array<{ longitude: number; latitude: number; reason: string }> = [];

    this.checkCoordinates(geometry, invalidCoordinates);

    const valid = invalidCoordinates.length === 0;

    return {
      valid,
      extraInfo: valid
        ? null
        : {
            invalidCoordinates
          }
    };
  }

  private checkCoordinates(
    geometry: Geometry,
    invalidCoordinates: Array<{ longitude: number; latitude: number; reason: string }>
  ): void {
    switch (geometry.type) {
      case "Point":
        this.checkPointCoordinates(geometry as Point, invalidCoordinates);
        break;
      case "Polygon":
        this.checkPolygonCoordinates(geometry as Polygon, invalidCoordinates);
        break;
      case "MultiPolygon":
        this.checkMultiPolygonCoordinates(geometry as MultiPolygon, invalidCoordinates);
        break;
      default:
        break;
    }
  }

  private checkPointCoordinates(
    point: Point,
    invalidCoordinates: Array<{ longitude: number; latitude: number; reason: string }>
  ): void {
    const [longitude, latitude] = point.coordinates;

    if (latitude < -90 || latitude > 90) {
      invalidCoordinates.push({
        longitude,
        latitude,
        reason: `Latitude ${latitude} is outside valid range [-90, 90]`
      });
    }

    if (longitude < -180 || longitude > 180) {
      invalidCoordinates.push({
        longitude,
        latitude,
        reason: `Longitude ${longitude} is outside valid range [-180, 180]`
      });
    }
  }

  private checkPolygonCoordinates(
    polygon: Polygon,
    invalidCoordinates: Array<{ longitude: number; latitude: number; reason: string }>
  ): void {
    for (const ring of polygon.coordinates) {
      for (const coordinate of ring) {
        const [longitude, latitude] = coordinate;

        if (latitude < -90 || latitude > 90) {
          invalidCoordinates.push({
            longitude,
            latitude,
            reason: `Latitude ${latitude} is outside valid range [-90, 90]`
          });
        }

        if (longitude < -180 || longitude > 180) {
          invalidCoordinates.push({
            longitude,
            latitude,
            reason: `Longitude ${longitude} is outside valid range [-180, 180]`
          });
        }
      }
    }
  }

  private checkMultiPolygonCoordinates(
    multiPolygon: MultiPolygon,
    invalidCoordinates: Array<{ longitude: number; latitude: number; reason: string }>
  ): void {
    for (const polygon of multiPolygon.coordinates) {
      for (const ring of polygon) {
        for (const coordinate of ring) {
          const [longitude, latitude] = coordinate;

          if (latitude < -90 || latitude > 90) {
            invalidCoordinates.push({
              longitude,
              latitude,
              reason: `Latitude ${latitude} is outside valid range [-90, 90]`
            });
          }

          if (longitude < -180 || longitude > 180) {
            invalidCoordinates.push({
              longitude,
              latitude,
              reason: `Longitude ${longitude} is outside valid range [-180, 180]`
            });
          }
        }
      }
    }
  }
}
