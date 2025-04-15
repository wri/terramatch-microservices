import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, STRING } from "sequelize";
import { Polygon } from "geojson";

@Table({ tableName: "landscape_geom", underscored: true })
export class LandscapeGeometry extends Model<LandscapeGeometry> {
  static readonly LANDSCAPE_SLUGS = [
    // Ghana Cocoa Belt
    "gcb",
    // Greater Rift Valley of Kenya
    "grv",
    // Lake Kivu & Rusizi River Basin
    "ikr"
  ] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  slug: string;

  @Column(STRING(50))
  landscape: string;

  @Column({ type: GEOMETRY })
  geometry: Polygon;
}
