import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT } from "sequelize";

@Table({ tableName: "i18n_translations", underscored: true })
export class I18nTranslation extends Model<I18nTranslation> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare i18nItemId: number;

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
