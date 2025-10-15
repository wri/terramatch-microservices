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
  BeforeCreate,
  BeforeUpdate,
  AfterFind
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, INTEGER, JSON, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { CriteriaId } from "../constants/validation-types";

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
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(INTEGER)
  criteriaId: CriteriaId;

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

  /**
   * Transform camelCase to snake_case before saving to database
   */
  @BeforeCreate
  @BeforeUpdate
  static transformExtraInfoForDb(instance: CriteriaSite) {
    if (instance.extraInfo != null) {
      instance.extraInfo = this.transformKeysToSnakeCase(instance.extraInfo, instance.criteriaId) as object | null;
    }
  }

  /**
   * Transform snake_case to camelCase after reading from database
   */
  @AfterFind
  static transformExtraInfoForApi(instances: CriteriaSite | CriteriaSite[]) {
    const records = Array.isArray(instances) ? instances : [instances];

    for (const instance of records) {
      if (instance.extraInfo != null) {
        instance.extraInfo = this.transformKeysToCamelCase(instance.extraInfo, instance.criteriaId) as object | null;
      }
    }
  }

  /**
   * Convert camelCase to snake_case
   */
  private static toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  private static toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Transform object keys from camelCase to snake_case
   */
  private static transformKeysToSnakeCase(obj: unknown, criteriaId: CriteriaId): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.transformKeysToSnakeCase(item, criteriaId));
    }

    if (typeof obj === "object") {
      const transformed: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const snakeKey = this.toSnakeCase(key);
        transformed[snakeKey] = this.transformKeysToSnakeCase(value, criteriaId);
      }
      return transformed;
    }

    return obj;
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
