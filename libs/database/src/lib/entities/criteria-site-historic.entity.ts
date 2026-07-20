import { AllowNull, AutoIncrement, BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, INTEGER, JSON, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { CriteriaId } from "../constants";

@Table({
  tableName: "criteria_site_historic",
  underscored: true,
  paranoid: false,
  indexes: [
    { name: "criteria_site_historic_polygon_id_index", fields: ["polygon_id"] },
    { name: "criteria_site_historic_criteria_id_index", fields: ["criteria_id"] }
  ]
})
export class CriteriaSiteHistoric extends Model<CriteriaSiteHistoric> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\CriteriaSiteHistoric";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Column(INTEGER)
  declare criteriaId: CriteriaId;

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
