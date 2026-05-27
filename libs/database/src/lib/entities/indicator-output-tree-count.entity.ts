import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, DATE, INTEGER, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";

@Table({ tableName: "indicator_output_tree_count", underscored: true, paranoid: true })
export class IndicatorOutputTreeCount extends Model<IndicatorOutputTreeCount> {
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
  @Column(STRING)
  declare surveyType: string | null;

  @AllowNull
  @Column(INTEGER)
  declare surveyId: number | null;

  @AllowNull
  @Column(INTEGER)
  declare treeCount: number | null;

  @AllowNull
  @Column(STRING)
  declare uncertaintyType: string | null;

  @AllowNull
  @Column(STRING)
  declare imagerySource: string | null;

  @AllowNull
  @Column(DATE)
  declare collectionDate: Date | null;

  @AllowNull
  @Column(STRING)
  declare imageryId: string | null;

  @AllowNull
  @Column(STRING)
  declare projectPhase: string | null;

  @AllowNull
  @Column(INTEGER)
  declare confidence: number | null;
}
