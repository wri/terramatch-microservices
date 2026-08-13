import {
  AutoIncrement,
  BelongsTo,
  Column,
  Default,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { FrameworkKey } from "../constants";
import { PolygonAttributeInputType } from "../constants/polygon-attribute-input-types";
import { Framework } from "./framework.entity";
import { PolygonAttributeDefinitionOption } from "./polygon-attribute-definition-option.entity";
import { SitePolygonAttributeValue } from "./site-polygon-attribute-value.entity";

@Table({
  tableName: "polygon_attribute_definitions",
  underscored: true,
  paranoid: true,
  hooks: {
    async afterDestroy(definition: PolygonAttributeDefinition) {
      await PolygonAttributeDefinitionOption.destroy({
        where: { polygonAttributeDefinitionId: definition.id }
      });
    }
  }
})
export class PolygonAttributeDefinition extends Model<
  InferAttributes<PolygonAttributeDefinition>,
  InferCreationAttributes<PolygonAttributeDefinition>
> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Column(STRING)
  declare key: string;

  @Column(STRING)
  declare label: string;

  @Column(STRING)
  declare inputType: PolygonAttributeInputType;

  @Column(STRING)
  declare frameworkKey: FrameworkKey;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  @Default(false)
  @Column(BOOLEAN)
  declare isRequired: CreationOptional<boolean>;

  @Default(true)
  @Column(BOOLEAN)
  declare isActive: CreationOptional<boolean>;

  @HasMany(() => PolygonAttributeDefinitionOption, {
    foreignKey: "polygonAttributeDefinitionId",
    constraints: false
  })
  declare options: PolygonAttributeDefinitionOption[] | null;

  @HasMany(() => SitePolygonAttributeValue, {
    foreignKey: "polygonAttributeDefinitionId",
    constraints: false
  })
  declare values: SitePolygonAttributeValue[] | null;
}
