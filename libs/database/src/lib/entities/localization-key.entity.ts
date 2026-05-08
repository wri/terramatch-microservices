import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, INTEGER, STRING, TEXT } from "sequelize";
import { I18nItem } from "./i18n-item.entity";

@Table({ tableName: "localization_keys", underscored: true })
export class LocalizationKey extends Model<InferAttributes<LocalizationKey>, InferCreationAttributes<LocalizationKey>> {
  static readonly I18N_FIELDS = ["value"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Column(STRING)
  key: string | null;

  @Column(TEXT)
  value: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  valueId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "value_id", constraints: false })
  i18nItem: I18nItem | null;
}
