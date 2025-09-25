import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, UUID, UUIDV4, QueryTypes } from "sequelize";
import { Polygon } from "geojson";
import { User } from "./user.entity";
import { InternalServerErrorException } from "@nestjs/common";

@Table({ tableName: "polygon_geometry", underscored: true, paranoid: true })
export class PolygonGeometry extends Model<PolygonGeometry> {
  static async checkIsSimple(polygonUuid: string): Promise<boolean | undefined> {
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

    return result[0]?.isSimple;
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

  static async getGeoJSON(polygonUuid: string): Promise<string | undefined> {
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

    return result[0]?.geoJson;
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

  static async getGeoJSONParsed(polygonUuid: string): Promise<Polygon | undefined> {
    const geoJsonString = await this.getGeoJSON(polygonUuid);
    if (geoJsonString == null) {
      return undefined;
    }
    return JSON.parse(geoJsonString) as Polygon;
  }

  static async getGeoJSONBatchParsed(polygonUuids: string[]): Promise<{ uuid: string; geoJson: Polygon }[]> {
    const results = await this.getGeoJSONBatch(polygonUuids);
    return results
      .map(r => ({ uuid: r.uuid, geoJson: JSON.parse(r.geoJson) as Polygon }))
      .filter(r => r.geoJson != null);
  }

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
}
