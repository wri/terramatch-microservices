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
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Column({ type: UUID })
  declare polyUuid: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polyUuid", targetKey: "uuid" })
  declare polygon: PolygonGeometry | null;

  @Column(STRING)
  declare entityType: string;

  @Column(BIGINT.UNSIGNED)
  declare entityId: number;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare lastModifiedBy: number | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  async loadPolygon() {
    if (this.polygon == null && this.polyUuid != null) {
      this.polygon = await this.$get("polygon");
    }
    return this.polygon;
  }
}
