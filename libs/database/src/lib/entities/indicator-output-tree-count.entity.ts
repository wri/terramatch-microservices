import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, DATE, INTEGER, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";

@Table({ tableName: "indicator_output_tree_count", underscored: true, paranoid: true })
export class IndicatorOutputTreeCount extends Model {
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
  @Column(STRING)
  surveyType: string | null;

  @AllowNull
  @Column(INTEGER)
  surveyId: number | null;

  @AllowNull
  @Column(INTEGER)
  treeCount: number | null;

  @AllowNull
  @Column(STRING)
  uncertaintyType: string | null;

  @AllowNull
  @Column(STRING)
  imagerySource: string | null;

  @AllowNull
  @Column(DATE)
  collectionDate: Date | null;

  @AllowNull
  @Column(STRING)
  imageryId: string | null;

  @AllowNull
  @Column(STRING)
  projectPhase: string | null;

  @AllowNull
  @Column(INTEGER)
  confidence: number | null;
}
