import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, JSON, UUID } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";

@Table({
  tableName: "site_polygon_data",
  underscored: true
})
export class SitePolygonData extends Model<SitePolygonData> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\SitePolygonData";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @ForeignKey(() => SitePolygon)
  @Column({ type: UUID, field: "site_polygon_uuid" })
  sitePolygonUuid: string;

  @BelongsTo(() => SitePolygon, { foreignKey: "sitePolygonUuid", targetKey: "uuid" })
  sitePolygon: SitePolygon | null;

  @AllowNull
  @Column(JSON)
  data: object | null;
}
