import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, UUID } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { PolygonAttributeDefinition } from "./polygon-attribute-definition.entity";
import { SitePolygon } from "./site-polygon.entity";

export type SitePolygonAttributeValueData = string | string[];

@Table({
  tableName: "site_polygon_attribute_values",
  underscored: true
})
export class SitePolygonAttributeValue extends Model<
  InferAttributes<SitePolygonAttributeValue>,
  InferCreationAttributes<SitePolygonAttributeValue>
> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => SitePolygon)
  @Index
  @Column({ type: UUID, field: "site_polygon_uuid" })
  declare sitePolygonUuid: string;

  @BelongsTo(() => SitePolygon, { foreignKey: "sitePolygonUuid", targetKey: "uuid", constraints: false })
  declare sitePolygon: SitePolygon | null;

  @ForeignKey(() => PolygonAttributeDefinition)
  @Index
  @Column(BIGINT.UNSIGNED)
  declare polygonAttributeDefinitionId: number;

  @BelongsTo(() => PolygonAttributeDefinition, {
    foreignKey: "polygonAttributeDefinitionId",
    constraints: false
  })
  declare definition: PolygonAttributeDefinition | null;

  @AllowNull
  @JsonColumn()
  declare value: SitePolygonAttributeValueData | null;
}
