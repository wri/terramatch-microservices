import {
  AllowNull,
  AutoIncrement,
  Column,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, NUMBER, STRING } from "sequelize";

@Table({ tableName: "localization_keys", underscored: true, paranoid: false })
export class LocalizationKeys extends Model<LocalizationKeys> {

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @AllowNull
  @Column(STRING)
  key: string | null;

  @AllowNull
  @Column(STRING)
  value: string | null;

  @AllowNull
  @Unique
  @Column(NUMBER)
  valueId: number;

}
