import { AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, JSON as JSON_TYPE, STRING } from "sequelize";
import { SitePolygon } from "./site-polygon.entity";
import { INDICATOR_SLUGS, IndicatorSlug } from "../constants";

@Table({ tableName: "indicator_output_hectares", underscored: true, paranoid: true })
export class IndicatorOutputHectares extends Model<IndicatorOutputHectares> {
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

  @Column({
    type: JSON_TYPE,
    // Sequelize has a bug where when the data for this model is fetched as part of an include on
    // findAll, the JSON value isn't getting deserialized.
    get(this: IndicatorOutputHectares): object {
      const value = this.getDataValue("value");
      return typeof value === "string" ? JSON.parse(value) : value;
    }
  })
  value: object;
}
