import { AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "indicator_output_tree_cover_loss", underscored: true, paranoid: true })
export class IndicatorOutputTreeCoverLoss extends Model<IndicatorOutputTreeCoverLoss> {
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

  @JsonColumn()
  declare value: object;
}
