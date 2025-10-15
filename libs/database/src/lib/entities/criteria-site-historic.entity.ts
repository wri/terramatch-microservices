import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Index,
  Model,
  PrimaryKey,
  Table,
  AfterFind
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, INTEGER, JSON, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { CriteriaId } from "../constants/validation-types";

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
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(INTEGER)
  criteriaId: CriteriaId;

  @Column(UUID)
  polygonId: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polygonId", targetKey: "uuid" })
  polygon: PolygonGeometry | null;

  @Column(BOOLEAN)
  valid: boolean;

  @AllowNull
  @Column(JSON)
  extraInfo: object | null;

  /**
   * Transform snake_case to camelCase after reading from database
   */
  @AfterFind
  static transformExtraInfoForApi(instances: CriteriaSiteHistoric | CriteriaSiteHistoric[]) {
    const records = Array.isArray(instances) ? instances : [instances];

    for (const instance of records) {
      if (instance.extraInfo != null) {
        instance.extraInfo = this.transformKeysToCamelCase(instance.extraInfo, instance.criteriaId) as object | null;
      }
    }
  }

  /**
   * Convert snake_case to camelCase
   */
  private static toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Transform object keys from snake_case to camelCase
   */
  private static transformKeysToCamelCase(obj: unknown, criteriaId: CriteriaId): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.transformKeysToCamelCase(item, criteriaId));
    }

    if (typeof obj === "object") {
      const transformed: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const camelKey = this.toCamelCase(key);
        transformed[camelKey] = this.transformKeysToCamelCase(value, criteriaId);
      }
      return transformed;
    }

    return obj;
  }
}
