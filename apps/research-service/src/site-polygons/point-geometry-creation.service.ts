import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { PointGeometry } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { Point } from "geojson";
import { Feature } from "./dto/create-site-polygon-request.dto";

@Injectable()
export class PointGeometryCreationService {
  private readonly logger = new Logger(PointGeometryCreationService.name);

  async createPointGeometriesFromFeatures(
    pointFeatures: Feature[],
    createdBy: number | null,
    transaction?: Transaction
  ): Promise<string[]> {
    if (pointFeatures.length === 0) {
      return [];
    }

    const pointGeometries = pointFeatures.map(feature => {
      const point = feature.geometry as Point;
      const properties = feature.properties ?? {};
      const estArea = (properties.estArea as number) ?? (properties.est_area as number) ?? null;

      return {
        uuid: uuidv4(),
        point,
        estimatedArea: estArea,
        createdBy
      };
    });

    try {
      const created = await PointGeometry.bulkCreate(pointGeometries as PointGeometry[], {
        transaction
      });

      return created.map(item => item.uuid);
    } catch (error) {
      this.logger.error("Error bulk inserting point geometries", error);
      throw new InternalServerErrorException(
        `Failed to create point geometries: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
