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
import { BIGINT, STRING, TEXT, UUID } from "sequelize";
import { User } from "./user.entity";

export type PolygonUpdateType = "update" | "status";

@Table({
  tableName: "polygon_updates",
  underscored: true,
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
  declare id: number;

  @Column({ type: UUID, field: "site_polygon_uuid" })
  declare sitePolygonUuid: string;

  @AllowNull
  @Column(STRING)
  declare versionName: string | null;

  @AllowNull
  @Column(TEXT)
  declare change: string | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare updatedById: number | null;

  @BelongsTo(() => User, { foreignKey: "updatedById" })
  declare updatedBy: User | null;

  @AllowNull
  @Column(TEXT)
  declare comment: string | null;

  @Column({ type: STRING, values: ["update", "status"] })
  declare type: PolygonUpdateType;

  @AllowNull
  @Column(STRING)
  declare oldStatus: string | null;

  @AllowNull
  @Column(STRING)
  declare newStatus: string | null;
}
