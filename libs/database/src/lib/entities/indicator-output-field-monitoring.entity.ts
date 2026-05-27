import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";

@Table({ tableName: "indicator_output_field_monitoring", underscored: true, paranoid: true })
export class IndicatorOutputFieldMonitoring extends Model<IndicatorOutputFieldMonitoring> {
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
  @Column(INTEGER)
  declare treeCount: number | null;

  @AllowNull
  @Column(STRING)
  declare projectPhase: string | null;

  @AllowNull
  @Column(STRING)
  declare species: string | null;

  @AllowNull
  @Column(INTEGER)
  declare survivalRate: number | null;
}
