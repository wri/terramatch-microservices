import { AllowNull, AutoIncrement, BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";

@Table({ tableName: "project_polygon", underscored: true, paranoid: true })
export class ProjectPolygon extends Model<ProjectPolygon> {
  static readonly LARAVEL_TYPE_PROJECT_PITCH = "App\\Models\\V2\\ProjectPitch";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column({ type: UUID })
  polyUuid: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polyUuid", targetKey: "uuid" })
  polygon: PolygonGeometry | null;

  @Column(STRING)
  entityType: string;

  @Column(BIGINT.UNSIGNED)
  entityId: number;

  @AllowNull
  @Column(STRING)
  lastModifiedBy: string | null;

  @AllowNull
  @Column(STRING)
  createdBy: string | null;

  async loadPolygon() {
    if (this.polygon == null && this.polyUuid != null) {
      this.polygon = await this.$get("polygon");
    }
    return this.polygon;
  }
}
