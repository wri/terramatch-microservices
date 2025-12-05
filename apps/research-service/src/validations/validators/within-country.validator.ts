import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { PolygonValidationResult, ValidationResult, Validator } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Transaction } from "sequelize";

interface WithinCountryValidationResult extends ValidationResult {
  extraInfo: {
    inside_percentage: number;
    country_name: string;
  } | null;
}

export class WithinCountryValidator implements Validator {
  private readonly THRESHOLD_PERCENTAGE = 75;

  async validatePolygon(polygonUuid: string): Promise<WithinCountryValidationResult> {
    const result = await this.getIntersectionData(polygonUuid);

    if (result == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found or has no associated project`);
    }

    const insidePercentage = Math.round((result.intersectionArea / result.polygonArea) * 100 * 100) / 100;
    const valid = insidePercentage >= this.THRESHOLD_PERCENTAGE;

    return {
      valid,
      extraInfo: {
        inside_percentage: insidePercentage,
        country_name: result.country
      }
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    if (polygonUuids.length === 0) {
      return [];
    }

    const results = await this.getIntersectionDataBatch(polygonUuids);
    const resultMap = new Map(results.filter(r => r != null).map(r => [r.polygonUuid, r]));

    const foundPolygonUuids = new Set(results.map(r => r.polygonUuid));
    const missingPolygonUuids = polygonUuids.filter(uuid => !foundPolygonUuids.has(uuid));

    const projectCountries =
      missingPolygonUuids.length > 0 ? await PolygonGeometry.getProjectCountriesBatch(missingPolygonUuids) : new Map();

    return polygonUuids.map(polygonUuid => {
      const result = resultMap.get(polygonUuid);

      if (result == null) {
        const projectCountry = projectCountries.get(polygonUuid);
        return {
          polygonUuid,
          valid: false,
          extraInfo: {
            inside_percentage: 0,
            country_name: projectCountry ?? "Unknown"
          }
        };
      }

      const insidePercentage = Math.round((result.intersectionArea / result.polygonArea) * 100 * 100) / 100;
      const valid = insidePercentage >= this.THRESHOLD_PERCENTAGE;

      return {
        polygonUuid,
        valid,
        extraInfo: {
          inside_percentage: insidePercentage,
          country_name: result.country
        }
      };
    });
  }

  private async getIntersectionData(polygonUuid: string): Promise<{
    polygonArea: number;
    intersectionArea: number;
    country: string;
  } | null> {
    const transaction = await PolygonGeometry.sql.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    let shouldCommit = true;

    try {
      const result = await PolygonGeometry.checkWithinCountryIntersection(polygonUuid, transaction);
      return result;
    } catch (error) {
      shouldCommit = false;
      await transaction.rollback();
      throw error;
    } finally {
      if (shouldCommit) {
        await transaction.commit();
      }
    }
  }

  private async getIntersectionDataBatch(polygonUuids: string[]): Promise<
    {
      polygonUuid: string;
      polygonArea: number;
      intersectionArea: number;
      country: string;
    }[]
  > {
    const transaction = await PolygonGeometry.sql.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    let shouldCommit = true;

    try {
      const results = await PolygonGeometry.checkWithinCountryIntersectionBatch(polygonUuids, transaction);
      return results;
    } catch (error) {
      shouldCommit = false;
      await transaction.rollback();
      throw error;
    } finally {
      if (shouldCommit) {
        await transaction.commit();
      }
    }
  }
}
