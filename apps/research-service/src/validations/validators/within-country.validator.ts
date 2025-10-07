import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { Transaction } from "sequelize";

interface WithinCountryValidationResult extends ValidationResult {
  extraInfo: {
    insidePercentage: number;
    countryName: string;
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
        insidePercentage,
        countryName: result.country
      }
    };
  }

  private async getIntersectionData(polygonUuid: string): Promise<{
    polygonArea: number;
    intersectionArea: number;
    country: string;
  } | null> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const transaction = await PolygonGeometry.sequelize.transaction({
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
}
