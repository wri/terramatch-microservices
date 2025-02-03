import {
  AllowNull,
  AutoIncrement,
  Column,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import { BIGINT, STRING } from "sequelize";

@Table({ tableName: "i18n_items", underscored: true, paranoid: false })
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
  @Column(STRING)
  longValue: string | null;

  @AllowNull
  @Column(STRING)
  hash: string | null;

}
