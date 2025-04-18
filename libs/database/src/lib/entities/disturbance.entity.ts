import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, INTEGER, STRING, TEXT, UUID } from "sequelize";
import { SiteReport } from "./site-report.entity";

@Scopes(() => ({
  approved: { where: { deletedAt: null } },
  climatic: { where: { type: "climatic" } },
  manmade: { where: { type: "manmade" } },
  ecological: { where: { type: "ecological" } }
}))
@Table({ tableName: "v2_disturbances", underscored: true, paranoid: true })
export class Disturbance extends Model<Disturbance> {
  static readonly LARAVEL_TYPE = "App\\Models\\Disturbance";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  disturbanceableType: string;

  @ForeignKey(() => SiteReport)
  @Column(BIGINT.UNSIGNED)
  disturbanceableId: number;

  @BelongsTo(() => SiteReport)
  siteReport: SiteReport | null;

  @Column(STRING)
  collection: string;

  @Column(STRING)
  type: string;

  @AllowNull
  @Column(STRING)
  intensity: string | null;

  @AllowNull
  @Column(STRING)
  extent: string | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  oldId: number | null;

  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @AllowNull
  @Column(DATE)
  override deletedAt: Date | null;

  @Column(DATE)
  override createdAt: Date;

  @Column(DATE)
  override updatedAt: Date;

  @AllowNull
  @Column(BOOLEAN)
  hidden: boolean;
}
