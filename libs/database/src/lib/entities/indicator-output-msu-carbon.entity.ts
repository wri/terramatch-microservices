import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";

@Table({ tableName: "indicator_output_msu_carbon", underscored: true, paranoid: true })
export class IndicatorOutputMsuCarbon extends Model<IndicatorOutputMsuCarbon> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Unique("unique_polygon_indicator_year")
  @ForeignKey(() => SitePolygon)
  @Column({ type: BIGINT.UNSIGNED })
  declare sitePolygonId: number;

  @Unique("unique_polygon_indicator_year")
  @Column({ type: STRING, values: INDICATOR_SLUGS })
  declare indicatorSlug: IndicatorSlug;

  @Unique("unique_polygon_indicator_year")
  @Column(INTEGER)
  declare yearOfAnalysis: number;

  @AllowNull
  @Column({ type: INTEGER, field: "carbon_ouput" })
  declare carbonOutput: number | null;

  @AllowNull
  @Column(STRING)
  declare projectPhase: string | null;

  @AllowNull
  @Column(INTEGER)
  declare confidence: number | null;
}
