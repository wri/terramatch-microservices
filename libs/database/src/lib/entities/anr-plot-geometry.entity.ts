import { AllowNull, AutoIncrement, BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
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
import { SitePolygon } from "./site-polygon.entity";

@Table({ tableName: "anr_plot_geometry", underscored: true, paranoid: true })
export class AnrPlotGeometry extends Model<InferAttributes<AnrPlotGeometry>, InferCreationAttributes<AnrPlotGeometry>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @Column({ type: UUID, field: "site_polygon_uuid" })
  sitePolygonUuid: string;

  @BelongsTo(() => SitePolygon, { foreignKey: "sitePolygonUuid", targetKey: "uuid" })
  sitePolygon: SitePolygon | null;

  @Column(JSON)
  geojson: object;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  plotCount: number | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;
}
