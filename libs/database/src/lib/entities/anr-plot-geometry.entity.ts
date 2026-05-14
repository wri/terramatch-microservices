import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  INTEGER,
  InferAttributes,
  InferCreationAttributes,
  JSON,
  UUID,
  UUIDV4
} from "sequelize";
import { InternalServerErrorException } from "@nestjs/common";
import { SitePolygon } from "./site-polygon.entity";

@Table({ tableName: "anr_plot_geometries", underscored: true, paranoid: true })
export class AnrPlotGeometry extends Model<InferAttributes<AnrPlotGeometry>, InferCreationAttributes<AnrPlotGeometry>> {
  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("AnrPlotGeometry model is missing sequelize connection");
    }
    return this.sequelize;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @ForeignKey(() => SitePolygon)
  @Column({ type: BIGINT.UNSIGNED, field: "site_polygon_id" })
  declare sitePolygonId: number;

  @BelongsTo(() => SitePolygon, { foreignKey: "sitePolygonId", targetKey: "id", constraints: false })
  declare sitePolygon: SitePolygon | null;

  @Column(JSON)
  declare geojson: object;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare plotCount: number | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;
}
