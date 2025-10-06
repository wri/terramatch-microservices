import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { QueryTypes, Transaction } from "sequelize";

interface WithinCountryValidationResult extends ValidationResult {
  extraInfo: {
    insidePercentage: number;
    countryName: string;
    polygonArea: number;
    intersectionArea: number;
  } | null;
}

interface WithinCountryQueryResult {
  polygon_area: number;
  intersection_area: number;
  country: string;
}

export class WithinCountryValidator implements Validator {
  private readonly THRESHOLD_PERCENTAGE = 75;

  async validatePolygon(polygonUuid: string): Promise<WithinCountryValidationResult> {
    const result = await this.getIntersectionData(polygonUuid);

    if (result == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found or has no associated project`);
    }

    const insidePercentage = Math.round((result.intersection_area / result.polygon_area) * 100 * 100) / 100;
    const valid = insidePercentage >= this.THRESHOLD_PERCENTAGE;

    return {
      valid,
      extraInfo: {
        insidePercentage,
        countryName: result.country,
        polygonArea: result.polygon_area,
        intersectionArea: result.intersection_area
      }
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    if (polygonUuids.length === 0) {
      return [];
    }

    const results = await this.getIntersectionDataBatch(polygonUuids);
    const resultMap = new Map(results.map(r => [r.polygon_uuid, r]));

    return polygonUuids.map(polygonUuid => {
      const result = resultMap.get(polygonUuid);

      if (result == null) {
        return {
          polygonUuid,
          valid: false,
          extraInfo: { error: "Polygon not found or has no associated project" }
        };
      }

      const insidePercentage = Math.round((result.intersection_area / result.polygon_area) * 100 * 100) / 100;
      const valid = insidePercentage >= this.THRESHOLD_PERCENTAGE;

      return {
        polygonUuid,
        valid,
        extraInfo: {
          insidePercentage,
          countryName: result.country,
          polygonArea: result.polygon_area,
          intersectionArea: result.intersection_area
        }
      };
    });
  }

  private async getIntersectionData(polygonUuid: string): Promise<WithinCountryQueryResult | null> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const transaction = await PolygonGeometry.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    try {
      const results = (await PolygonGeometry.sequelize.query(
        `
        SELECT 
          ST_Area(pg.geom) as polygon_area,
          ST_Area(ST_Intersection(pg.geom, wcg.geometry)) as intersection_area,
          wcg.country
        FROM polygon_geometry pg
        JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
        JOIN v2_sites s ON s.uuid = sp.site_id
        JOIN v2_projects p ON p.id = s.project_id
        JOIN world_countries_generalized wcg ON wcg.iso = p.country
        WHERE pg.uuid = :polygonUuid
          AND ST_Area(pg.geom) > 0
        `,
        {
          replacements: { polygonUuid },
          type: QueryTypes.SELECT,
          transaction
        }
      )) as WithinCountryQueryResult[];

      await transaction.commit();

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async getIntersectionDataBatch(
    polygonUuids: string[]
  ): Promise<(WithinCountryQueryResult & { polygon_uuid: string })[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const transaction = await PolygonGeometry.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    try {
      const results = (await PolygonGeometry.sequelize.query(
        `
        SELECT 
          pg.uuid as polygon_uuid,
          ST_Area(pg.geom) as polygon_area,
          ST_Area(ST_Intersection(pg.geom, wcg.geometry)) as intersection_area,
          wcg.country
        FROM polygon_geometry pg
        JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
        JOIN v2_sites s ON s.uuid = sp.site_id
        JOIN v2_projects p ON p.id = s.project_id
        JOIN world_countries_generalized wcg ON wcg.iso = p.country
        WHERE pg.uuid IN (:polygonUuids)
          AND ST_Area(pg.geom) > 0
        `,
        {
          replacements: { polygonUuids },
          type: QueryTypes.SELECT,
          transaction
        }
      )) as (WithinCountryQueryResult & { polygon_uuid: string })[];

      await transaction.commit();

      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
