import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT } from "sequelize";

@Table({ tableName: "i18n_translations", underscored: true })
export class I18nTranslation extends Model<I18nTranslation> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @AllowNull
  @Unique
  @Column(INTEGER({ length: 11 }))
  i18nItemId: number;

  @AllowNull
  @Column(STRING)
  language: string | null;

  @AllowNull
  @Column(STRING)
  shortValue: string | null;

  @AllowNull
  @Column(TEXT)
  longValue: string | null;
}
