import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING, TEXT } from "sequelize";
import { I18nTranslation } from "./i18n-translation.entity";

@Table({ tableName: "i18n_items", underscored: true })
export class I18nItem extends Model<I18nItem> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(STRING)
  shortValue: string | null;

  @AllowNull
  @Column(TEXT)
  longValue: string | null;

  @AllowNull
  @Column(STRING)
  hash: string | null;

  @HasMany(() => I18nTranslation, { foreignKey: "i18nItemId", constraints: false })
  i18nTranslations: I18nTranslation[] | null;
}
