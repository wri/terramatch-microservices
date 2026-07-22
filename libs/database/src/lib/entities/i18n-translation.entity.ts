import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT } from "sequelize";
import { I18nItem } from "./i18n-item.entity";

@Table({ tableName: "i18n_translations", underscored: true })
export class I18nTranslation extends Model<I18nTranslation> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare i18nItemId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "i18n_item_id", constraints: false })
  declare i18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  declare language: string | null;

  @AllowNull
  @Column(STRING)
  declare shortValue: string | null;

  @AllowNull
  @Column(TEXT)
  declare longValue: string | null;
}
