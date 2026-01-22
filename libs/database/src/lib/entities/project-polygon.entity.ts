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
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { User } from "./user.entity";

@Table({ tableName: "project_polygon", underscored: true, paranoid: true })
export class ProjectPolygon extends Model<ProjectPolygon> {
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

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  lastModifiedBy: number | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  async loadPolygon() {
    if (this.polygon == null && this.polyUuid != null) {
      this.polygon = await this.$get("polygon");
    }
    return this.polygon;
  }
}
