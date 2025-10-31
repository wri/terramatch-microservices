import { Injectable, BadRequestException, InternalServerErrorException, Logger } from "@nestjs/common";
import { PointGeometry } from "@terramatch-microservices/database/entities";
import { QueryTypes, Transaction } from "sequelize";
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

    if (PointGeometry.sequelize == null) {
      throw new InternalServerErrorException("PointGeometry model is missing sequelize connection");
    }

    const pointGeometries = pointFeatures.map(feature => {
      const point = feature.geometry as Point;
      const properties = feature.properties ?? {};
      const estArea = (properties.est_area as number) ?? null;

      return {
        uuid: uuidv4(),
        geomJson: JSON.stringify(point),
        estArea
      };
    });

    try {
      const valueSets = pointGeometries
        .map(
          (_, index) => `(:uuid${index}, ST_GeomFromGeoJSON(:geomJson${index}), :estArea${index}, :createdBy${index})`
        )
        .join(", ");

      const replacements: Record<string, string | number | null> = {};
      pointGeometries.forEach((item, index) => {
        replacements[`uuid${index}`] = item.uuid;
        replacements[`geomJson${index}`] = item.geomJson;
        replacements[`estArea${index}`] = item.estArea;
        replacements[`createdBy${index}`] = createdBy;
      });

      const query = `
        INSERT INTO point_geometry (uuid, geom, est_area, created_by)
        VALUES ${valueSets}
      `;

      await PointGeometry.sequelize.query(query, {
        replacements,
        type: QueryTypes.INSERT,
        transaction
      });

      this.logger.log(`Created ${pointGeometries.length} point geometries`);
      return pointGeometries.map(item => item.uuid);
    } catch (error) {
      this.logger.error("Error bulk inserting point geometries", error);
      throw new InternalServerErrorException(
        `Failed to create point geometries: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
