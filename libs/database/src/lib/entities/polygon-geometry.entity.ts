import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, UUID, UUIDV4, DOUBLE } from "sequelize";
import { Polygon } from "geojson";
import { User } from "./user.entity";

@Table({ tableName: "polygon_geometry", underscored: true, paranoid: true })
export class PolygonGeometry extends Model<PolygonGeometry> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column({ type: GEOMETRY, field: "geom" })
  polygon: Polygon;

  @AllowNull
  @Column({ type: DOUBLE })
  centroidLatitude: number | null;

  @AllowNull
  @Column({ type: DOUBLE })
  centroidLongitude: number | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;
}
