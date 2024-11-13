import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";

@Table({ tableName: "indicator_output_field_monitoring", underscored: true, paranoid: true })
export class IndicatorOutputFieldMonitoring extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique("unique_polygon_indicator_year")
  @ForeignKey(() => SitePolygon)
  @Column({ type: BIGINT.UNSIGNED })
  sitePolygonId: number;

  @Unique("unique_polygon_indicator_year")
  @Column({ type: STRING, values: INDICATOR_SLUGS })
  indicatorSlug: IndicatorSlug;

  @Unique("unique_polygon_indicator_year")
  @Column(INTEGER)
  yearOfAnalysis: number;

  @AllowNull
  @Column(INTEGER)
  treeCount: number | null;

  @AllowNull
  @Column(STRING)
  projectPhase: string | null;

  @AllowNull
  @Column(STRING)
  species: string | null;

  @AllowNull
  @Column(INTEGER)
  survivalRate: number | null;
}
