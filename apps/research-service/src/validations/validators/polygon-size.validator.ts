import { SitePolygon, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { PolygonValidator, GeometryValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { Geometry, Polygon } from "geojson";
import { QueryTypes } from "sequelize";

interface PolygonSizeValidationResult extends ValidationResult {
  extraInfo: {
    area_hectares: number;
  } | null;
}

const MAX_AREA_HECTARES = 1000;
const MAX_AREA_SQ_METERS = 1000000; // 1000 hectares = 1,000,000 square meters

export class PolygonSizeValidator implements PolygonValidator, GeometryValidator {
  async validatePolygon(polygonUuid: string): Promise<PolygonSizeValidationResult> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid, isActive: true },
      attributes: ["calcArea"]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const areaHectares = sitePolygon.calcArea ?? 0;
    const valid = areaHectares <= MAX_AREA_HECTARES;

    return {
      valid,
      extraInfo: {
        area_hectares: areaHectares
      }
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const sitePolygons = await SitePolygon.findAll({
      where: {
        polygonUuid: polygonUuids,
        isActive: true
      },
      attributes: ["polygonUuid", "calcArea"]
    });

    const resultMap = new Map(sitePolygons.map(polygon => [polygon.polygonUuid, polygon.calcArea ?? 0]));

    return polygonUuids.map(polygonUuid => {
      const areaHectares = resultMap.get(polygonUuid) ?? 0;
      const valid = areaHectares <= MAX_AREA_HECTARES;

      return {
        polygonUuid,
        valid,
        extraInfo: {
          area_hectares: areaHectares
        }
      };
    });
  }

  async validateGeometry(
    geometry: Geometry,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Required by GeometryValidator interface
    _properties?: Record<string, unknown>
  ): Promise<PolygonSizeValidationResult> {
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      return {
        valid: true,
        extraInfo: {
          area_hectares: 0
        }
      };
    }

    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    let totalAreaSqMeters = 0;

    if (geometry.type === "Polygon") {
      totalAreaSqMeters = await this.calculateAreaFromGeoJSON(geometry);
    } else if (geometry.type === "MultiPolygon") {
      for (const polygonCoordinates of geometry.coordinates) {
        const polygonGeometry: Polygon = {
          type: "Polygon",
          coordinates: polygonCoordinates
        };
        const areaSqMeters = await this.calculateAreaFromGeoJSON(polygonGeometry);
        totalAreaSqMeters += areaSqMeters;
      }
    }

    const areaHectares = totalAreaSqMeters / 10000;
    const valid = totalAreaSqMeters <= MAX_AREA_SQ_METERS;

    return {
      valid,
      extraInfo: {
        area_hectares: areaHectares
      }
    };
  }

  private async calculateAreaFromGeoJSON(geometry: Geometry): Promise<number> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const geojson = JSON.stringify({
      type: "Feature",
      geometry,
      crs: { type: "name", properties: { name: "EPSG:4326" } }
    });

    const result = (await PolygonGeometry.sequelize.query(
      `
        SELECT
          ST_Area(ST_GeomFromGeoJSON(:geojson)) AS area,
          ST_Y(ST_Centroid(ST_GeomFromGeoJSON(:geojson))) AS latitude
        FROM (SELECT 1) AS dummy
      `,
      {
        replacements: { geojson },
        type: QueryTypes.SELECT
      }
    )) as Array<{ area: number; latitude: number }>;

    if (result.length === 0 || result[0] == null) {
      return 0;
    }

    const areaSqDegrees = result[0].area;
    const latitude = result[0].latitude;
    const unitLatitude = 111320;
    const latitudeRad = (latitude * Math.PI) / 180;
    return areaSqDegrees * Math.pow(unitLatitude * Math.cos(latitudeRad), 2);
  }
}
