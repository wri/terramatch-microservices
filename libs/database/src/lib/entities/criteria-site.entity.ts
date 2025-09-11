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
import { BIGINT, BOOLEAN, DATE, INTEGER, JSON, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";

@Table({
  tableName: "criteria_site",
  underscored: true,
  paranoid: false,
  indexes: [
    { name: "criteria_site_polygon_id_index", fields: ["polygon_id"] },
    { name: "criteria_site_criteria_id_index", fields: ["criteria_id"] }
  ]
})
export class CriteriaSite extends Model<CriteriaSite> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\CriteriaSite";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(INTEGER)
  criteriaId: number;

  @ForeignKey(() => PolygonGeometry)
  @Column(UUID)
  polygonId: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polygonId", targetKey: "uuid" })
  polygon: PolygonGeometry | null;

  @Column(BOOLEAN)
  valid: boolean;

  @AllowNull
  @Column(JSON)
  extraInfo: object | null;

  @Column(DATE)
  override createdAt: Date;

  @Column(DATE)
  override updatedAt: Date;
}
