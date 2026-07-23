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
import { BIGINT, BOOLEAN, INTEGER, JSON, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { CriteriaId } from "../constants";

@Table({
  tableName: "criteria_site",
  underscored: true,
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
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Column(INTEGER)
  declare criteriaId: CriteriaId;

  @ForeignKey(() => PolygonGeometry)
  @Column(UUID)
  declare polygonId: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polygonId", targetKey: "uuid" })
  declare polygon: PolygonGeometry | null;

  @Column(BOOLEAN)
  declare valid: boolean;

  @AllowNull
  @Column(JSON)
  declare extraInfo: object | null;
}
