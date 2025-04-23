import {
  AllowNull,
  AutoIncrement,
  Column,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, INTEGER, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";

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

  @Column(BIGINT.UNSIGNED)
  disturbanceableType: number;

  @Column(BIGINT.UNSIGNED)
  disturbanceableId: number;
}
