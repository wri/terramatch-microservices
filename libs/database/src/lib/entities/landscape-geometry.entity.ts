import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, STRING } from "sequelize";
import { Polygon } from "geojson";

@Table({ tableName: "landscape_geom", underscored: true })
export class LandscapeGeometry extends Model<LandscapeGeometry> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column({ type: GEOMETRY })
  geometry: Polygon;

  @Column(STRING(50))
  landscape: string;
}
