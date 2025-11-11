import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, STRING, TEXT, UUID } from "sequelize";
import { User } from "./user.entity";

export type PolygonUpdateType = "update" | "status";

/**
 * Entity for tracking all changes made to site polygons.
 * Provides audit trail for versioning system.
 *
 * Note: sitePolygonUuid references the primaryUuid field of site_polygon,
 * not the uuid field. This allows tracking changes across all versions
 * of a polygon as a group.
 */
@Table({
  tableName: "polygon_updates",
  underscored: true,
  paranoid: false, // No soft deletes for audit records
  timestamps: true
})
export class PolygonUpdates extends Model<PolygonUpdates> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\PolygonUpdates";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  /**
   * References site_polygon.primary_uuid (NOT site_polygon.uuid!)
   * This allows tracking changes across all versions of a polygon.
   */
  @Index
  @Column({ type: UUID, field: "site_polygon_uuid" })
  sitePolygonUuid: string;

  /**
   * Virtual relationship to SitePolygon via primaryUuid
   * Note: This won't work with standard associations since we're
   * linking to primaryUuid instead of uuid. Use manual queries instead.
   */
  // @BelongsTo(() => SitePolygon, { foreignKey: "sitePolygonUuid", targetKey: "primaryUuid" })
  // sitePolygon: SitePolygon | null;

  /**
   * Version name when this change occurred
   * Format: {poly_name}_{date}_{time}_{username}
   * Example: "North_Field_22_October_2025_15_21_11_John_Doe"
   */
  @AllowNull
  @Column(STRING)
  versionName: string | null;

  /**
   * Description of what changed
   * Examples:
   * - "poly_name => from 'Old Name' to 'New Name', num_trees => from 100 to 150"
   * - "Geometry updated via admin interface"
   * - "Clipped due to overlap, area reduced from 2.5ha to 2.3ha"
   */
  @AllowNull
  @Column(TEXT)
  change: string | null;

  /**
   * User who made the change
   */
  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  updatedById: number | null;

  @BelongsTo(() => User, { foreignKey: "updatedById" })
  updatedBy: User | null;

  /**
   * Optional comment from user explaining the change
   */
  @AllowNull
  @Column(TEXT)
  comment: string | null;

  /**
   * Type of change:
   * - 'update': Attribute or geometry changes
   * - 'status': Status changes only
   */
  @Column({ type: STRING, values: ["update", "status"] })
  type: PolygonUpdateType;

  /**
   * For status changes: the previous status value
   */
  @AllowNull
  @Column(STRING)
  oldStatus: string | null;

  /**
   * For status changes: the new status value
   */
  @AllowNull
  @Column(STRING)
  newStatus: string | null;

  /**
   * Timestamp when record was created
   */
  @Column({ type: DATE, field: "created_at" })
  override createdAt: Date;

  /**
   * Timestamp when record was last updated
   */
  @Column({ type: DATE, field: "updated_at" })
  override updatedAt: Date;
}
