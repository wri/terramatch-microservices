import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, UUID, UUIDV4, QueryTypes } from "sequelize";
import { Polygon } from "geojson";
import { User } from "./user.entity";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";

@Table({ tableName: "polygon_geometry", underscored: true, paranoid: true })
export class PolygonGeometry extends Model<PolygonGeometry> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column({ type: GEOMETRY, field: "geom" })
  polygon: Polygon;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  static async checkIsSimple(polygonUuid: string): Promise<boolean> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const result = (await this.sequelize.query(
      `
        SELECT ST_IsSimple(geom) as isSimple
        FROM polygon_geometry 
        WHERE uuid = :polygonUuid
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT
      }
    )) as { isSimple: boolean }[];

    if (result.length === 0) {
      throw new NotFoundException();
    }

    return result[0].isSimple;
  }

  static async checkIsSimpleBatch(polygonUuids: string[]): Promise<{ uuid: string; isSimple: boolean }[]> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    return (await this.sequelize.query(
      `
        SELECT uuid, ST_IsSimple(geom) as isSimple
        FROM polygon_geometry 
        WHERE uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT
      }
    )) as { uuid: string; isSimple: boolean }[];
  }

  static async getGeoJSON(polygonUuid: string): Promise<string> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const result = (await this.sequelize.query(
      `
        SELECT ST_AsGeoJSON(geom) as geoJson
        FROM polygon_geometry 
        WHERE uuid = :polygonUuid
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT
      }
    )) as { geoJson: string }[];

    if (result.length === 0) {
      throw new NotFoundException();
    }

    return result[0].geoJson;
  }

  static async getGeoJSONBatch(polygonUuids: string[]): Promise<{ uuid: string; geoJson: string }[]> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    return (await this.sequelize.query(
      `
        SELECT uuid, ST_AsGeoJSON(geom) as geoJson
        FROM polygon_geometry 
        WHERE uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT
      }
    )) as { uuid: string; geoJson: string }[];
  }
}
