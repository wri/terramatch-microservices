import {
  AllowNull,
  AutoIncrement,
  Column,
  Model, NotNull,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, INTEGER, NUMBER, STRING, TEXT } from "sequelize";

@Table({ tableName: "localization_keys", underscored: true })
export class LocalizationKey extends Model<LocalizationKey> {

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @NotNull
  @AllowNull(false)
  @Column(TEXT)
  key: string | null;

  @NotNull
  @AllowNull(false)
  @Column(TEXT)
  value: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  valueId: number;

}
