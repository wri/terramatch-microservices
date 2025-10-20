import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Polygon, MultiPolygon } from "geojson";
import { GEOMETRY } from "sequelize";

@Table({ tableName: "world_countries_generalized", timestamps: false, paranoid: false })
export class WorldCountryGeneralized extends Model<WorldCountryGeneralized> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\WorldCountryGeneralized";

  @PrimaryKey
  @AutoIncrement
  @Column({
    field: "OGR_FID",
    type: DataType.INTEGER
  })
  OGRFID: number;

  @Column({ type: DataType.STRING(50) })
  country: string;

  @Column({ type: DataType.STRING(3) })
  iso: string;

  @Column({ type: DataType.STRING(50) })
  countryaff: string;

  @Column({ type: DataType.STRING(2), field: "alpha_2_iso" })
  alpha2Iso: string;

  @Column({ type: GEOMETRY })
  geometry: Polygon | MultiPolygon;
}
