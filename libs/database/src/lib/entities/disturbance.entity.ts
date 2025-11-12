import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DATE,
  DECIMAL,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { Subquery } from "../util/subquery.builder";
import { Literal } from "sequelize/types/utils";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "v2_disturbances", underscored: true, paranoid: true })
export class Disturbance extends Model<InferAttributes<Disturbance>, InferCreationAttributes<Disturbance>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Disturbance";
  static readonly POLYMORPHIC_TYPE = "disturbanceableType";
  static readonly POLYMORPHIC_ID = "disturbanceableId";

  static idsSubquery(disturbanceableIds: Literal | number[], disturbanceableType: string) {
    return Subquery.select(Disturbance, "id")
      .eq("disturbanceableType", disturbanceableType)
      .in("disturbanceableId", disturbanceableIds)
      .eq("hidden", false).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @Column(STRING)
  disturbanceableType: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  disturbanceableId: number | null;

  @AllowNull
  @Column(DATE)
  disturbanceDate: Date | null;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @JsonColumn()
  subtype: string[] | null;

  @AllowNull
  @Column(STRING)
  intensity: string | null;

  @AllowNull
  @Column(STRING)
  extent: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  peopleAffected: number | null;

  @AllowNull
  @Column(DECIMAL(15, 2))
  monetaryDamage: number | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(TEXT)
  actionDescription: string | null;

  @AllowNull
  @JsonColumn()
  propertyAffected: string[] | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: CreationOptional<boolean>;
}
