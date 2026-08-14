import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, JSON, UUID } from "sequelize";
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
  @Column({ type: UUID, field: "site_polygon_uuid" })
  declare sitePolygonUuid: string;

  @BelongsTo(() => SitePolygon, { foreignKey: "sitePolygonUuid", targetKey: "uuid", constraints: false })
  declare sitePolygon: SitePolygon | null;

  @ForeignKey(() => PolygonAttributeDefinition)
  @Column(BIGINT.UNSIGNED)
  declare polygonAttributeDefinitionId: number;

  @BelongsTo(() => PolygonAttributeDefinition, {
    foreignKey: "polygonAttributeDefinitionId",
    constraints: false
  })
  declare definition: PolygonAttributeDefinition | null;

  // Use Column(JSON), not JsonColumn: values are string | string[], and JsonColumn's
  // JSON.parse on already-deserialized string primitives throws (e.g. "farmer-managed").
  @AllowNull
  @Column(JSON)
  declare value: SitePolygonAttributeValueData | null;
}
