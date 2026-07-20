import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
  AfterFind
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, INTEGER, JSON, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { CriteriaId } from "../constants";
import { transformKeysToCamelCase } from "../util/case-transformation.util";

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

  /**
   * `extraInfo` is always written in camelCase by the validators. This hook only exists to bridge
   * legacy rows that still have snake_case `extraInfo` from before that was true - see
   * transformKeysToCamelCase for details. It can be removed once that legacy data is backfilled.
   */
  @AfterFind
  static transformExtraInfoForApi(instances: CriteriaSite | CriteriaSite[]) {
    const records = Array.isArray(instances) ? instances : [instances];

    for (const instance of records) {
      if (instance.extraInfo != null) {
        instance.extraInfo = transformKeysToCamelCase(instance.extraInfo, instance.criteriaId) as object | null;
      }
    }
  }
}
