import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, UUID } from "sequelize";
import { Polygon } from "geojson";
import { User } from "./user.entity";

@Table({ tableName: "polygon_geometry", underscored: true, paranoid: true })
export class PolygonGeometry extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column({ type: GEOMETRY, field: "geom" })
  polygon: Polygon;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;
}
