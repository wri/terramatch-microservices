import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING, TEXT } from "sequelize";

@Table({ tableName: "i18n_items", underscored: true })
export class i18nItem extends Model<i18nItem> {
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
}
