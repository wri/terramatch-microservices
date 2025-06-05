import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
@Table({ tableName: "world_countries_generalized", timestamps: false, paranoid: false })
export class WorldCountryGeneralized extends Model<WorldCountryGeneralized> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\WorldCountryGeneralized";

  @PrimaryKey
  @AutoIncrement
  @Column({
    field: "OGR_FID",
    type: DataType.INTEGER.UNSIGNED
  })
  OGRFID: number;

  @Column({ type: DataType.STRING(50) })
  country: string;

  @Column({ type: DataType.STRING(3) })
  iso: string;

  @Column({ type: DataType.STRING(50) })
  countryaff: string;

  @Column({ type: DataType.STRING(2) })
  alpha_2_iso: string;
}
