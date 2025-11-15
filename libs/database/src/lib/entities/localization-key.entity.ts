import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT } from "sequelize";
import { I18nItem } from "./i18n-item.entity";

@Table({ tableName: "localization_keys", underscored: true })
export class LocalizationKey extends Model<LocalizationKey> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  key: string | null;

  @Column(TEXT)
  value: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  valueId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "value_id", constraints: false })
  i18nItem: I18nItem;
}
