import {
  AllowNull,
  AutoIncrement,
  Column,
  Model,
  PrimaryKey,
  Table, Unique
} from "sequelize-typescript";
import { BIGINT, NUMBER, STRING } from "sequelize";

@Table({ tableName: "i18n_translations", underscored: true, paranoid: false })
export class i18nTranslation extends Model<i18nTranslation> {

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @AllowNull
  @Unique
  @Column(NUMBER)
  i18nItemId: number;

  @AllowNull
  @Column(STRING)
  language: string | null;

  @AllowNull
  @Column(STRING)
  shortValue: string | null;

  @AllowNull
  @Column(STRING)
  longValue: string | null;

}
