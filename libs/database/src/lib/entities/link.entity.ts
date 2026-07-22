import {
  AutoIncrement,
  BelongsTo,
  Column,
  DefaultScope,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { I18nItem } from "./i18n-item.entity";
import { chainScope } from "../util/chain-scope";
import { LaravelModel, laravelType } from "../types/util";

@DefaultScope(() => ({ order: ["order"] }))
@Scopes(() => ({
  associations: <T extends LaravelModel>(associations: T | T[]) => {
    const models = Array.isArray(associations) ? associations : [associations];
    return {
      where: {
        linkableType: laravelType(models[0]),
        linkableId: models[0].id
      }
    };
  }
}))
@Table({ tableName: "links", underscored: true, paranoid: true })
export class Link extends Model<InferAttributes<Link>, InferCreationAttributes<Link>> {
  static for<T extends LaravelModel>(models: T | T[]) {
    return chainScope(this, "associations", models) as typeof Link;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Column(TINYINT)
  declare order: number;

  @Column(BIGINT.UNSIGNED)
  declare titleId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "title_id", constraints: false })
  declare title: I18nItem | null;

  @Column(STRING)
  declare url: string;

  @Column(STRING)
  declare linkableType: string;

  @Column(BIGINT.UNSIGNED)
  declare linkableId: number;
}
