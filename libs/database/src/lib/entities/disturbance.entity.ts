import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "v2_disturbances", underscored: true, paranoid: true })
export class Disturbance extends Model<Disturbance> {
  static readonly LARAVEL_TYPE = "App\\Models\\SiteSubmissionDisturbance";

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

  @Column(TINYINT)
  hidden: number | null;
}
