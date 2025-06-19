import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";
import { Subquery } from "../util/subquery.builder";
import { Literal } from "sequelize/types/utils";

@Table({ tableName: "v2_disturbances", underscored: true, paranoid: true })
export class Disturbance extends Model<Disturbance> {
  static readonly LARAVEL_TYPE = "App\\Models\\SiteSubmissionDisturbance";

  static idsSubquery(disturbanceIds: Literal | number[], disturbancelType: string) {
    return Subquery.select(Disturbance, "id")
      .eq("disturbanceableType", disturbancelType)
      .in("disturbanceableId", disturbanceIds)
      .eq("hidden", false).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(STRING)
  disturbanceableType: string;

  @Column(BIGINT.UNSIGNED)
  disturbanceableId: number;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(STRING)
  intensity: string | null;

  @AllowNull
  @Column(STRING)
  extent: string | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @Column(TINYINT)
  hidden: number | null;
}
