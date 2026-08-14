import { AutoIncrement, BelongsTo, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { PolygonAttributeDefinition } from "./polygon-attribute-definition.entity";

@Table({
  tableName: "polygon_attribute_definition_options",
  underscored: true,
  paranoid: true
})
export class PolygonAttributeDefinitionOption extends Model<
  InferAttributes<PolygonAttributeDefinitionOption>,
  InferCreationAttributes<PolygonAttributeDefinitionOption>
> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @ForeignKey(() => PolygonAttributeDefinition)
  @Column(BIGINT.UNSIGNED)
  declare polygonAttributeDefinitionId: number;

  @BelongsTo(() => PolygonAttributeDefinition, {
    foreignKey: "polygonAttributeDefinitionId",
    constraints: false
  })
  declare definition: PolygonAttributeDefinition | null;

  @Column(STRING)
  declare value: string;

  @Column(STRING)
  declare label: string;

  @Column(INTEGER)
  declare order: number;
}
