import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, STRING, TEXT, UUID } from "sequelize";
import { User } from "./user.entity";

export type PolygonUpdateType = "update" | "status";

@Table({
  tableName: "polygon_updates",
  underscored: true,
  paranoid: false,
  timestamps: true,
  indexes: [
    {
      name: "polygon_updates_site_polygon_uuid",
      fields: ["site_polygon_uuid"]
    }
  ]
})
export class PolygonUpdates extends Model<PolygonUpdates> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\PolygonUpdates";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column({ type: UUID, field: "site_polygon_uuid" })
  sitePolygonUuid: string;

  @AllowNull
  @Column(STRING)
  versionName: string | null;

  @AllowNull
  @Column(TEXT)
  change: string | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  updatedById: number | null;

  @BelongsTo(() => User, { foreignKey: "updatedById" })
  updatedBy: User | null;

  @AllowNull
  @Column(TEXT)
  comment: string | null;

  @Column({ type: STRING, values: ["update", "status"] })
  type: PolygonUpdateType;

  @AllowNull
  @Column(STRING)
  oldStatus: string | null;

  @AllowNull
  @Column(STRING)
  newStatus: string | null;

  @Column({ type: DATE, field: "created_at" })
  override createdAt: Date;

  @Column({ type: DATE, field: "updated_at" })
  override updatedAt: Date;
}
