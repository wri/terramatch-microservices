import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";

interface PolygonSizeValidationResult extends ValidationResult {
  extraInfo: {
    area_hectares: number;
  } | null;
}

export class PolygonSizeValidator implements Validator {
  private static readonly MAX_AREA_HECTARES = 1000;

  async validatePolygon(polygonUuid: string): Promise<PolygonSizeValidationResult> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid, isActive: true },
      attributes: ["calcArea"]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const areaHectares = sitePolygon.calcArea ?? 0;
    const valid = areaHectares <= PolygonSizeValidator.MAX_AREA_HECTARES;

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
      const valid = areaHectares <= PolygonSizeValidator.MAX_AREA_HECTARES;

      return {
        polygonUuid,
        valid,
        extraInfo: {
          area_hectares: areaHectares
        }
      };
    });
  }
}
