import {
  AutoIncrement,
  BelongsTo,
  Column,
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
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { FrameworkKey } from "../constants";
import { Framework } from "./framework.entity";
import { PolygonAttributeDefinitionOption } from "./polygon-attribute-definition-option.entity";

export const POLYGON_ATTRIBUTE_INPUT_TYPES = ["single_select", "multi_select"] as const;
export type PolygonAttributeInputType = (typeof POLYGON_ATTRIBUTE_INPUT_TYPES)[number];

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

  @Column(TEXT)
  declare label: string;

  @Column(STRING)
  declare inputType: PolygonAttributeInputType;

  @Column(STRING)
  declare frameworkKey: FrameworkKey;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare isRequired: CreationOptional<boolean>;

  @Column({ type: BOOLEAN, defaultValue: true })
  declare isActive: CreationOptional<boolean>;

  @HasMany(() => PolygonAttributeDefinitionOption, {
    foreignKey: "polygonAttributeDefinitionId",
    constraints: false
  })
  declare options: PolygonAttributeDefinitionOption[] | null;
}
