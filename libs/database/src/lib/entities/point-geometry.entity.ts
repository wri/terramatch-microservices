import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DECIMAL, GEOMETRY, UUID, UUIDV4 } from "sequelize";
import { Point } from "geojson";
import { User } from "./user.entity";
import { InternalServerErrorException } from "@nestjs/common";

@Table({ tableName: "point_geometry", underscored: true, paranoid: true })
export class PointGeometry extends Model<PointGeometry> {
  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PointGeometry model is missing sequelize connection");
    }
    return this.sequelize;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column({ type: GEOMETRY, field: "geom" })
  point: Point;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: "est_area" })
  estimatedArea: number;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  lastModifiedBy: number | null;
}
