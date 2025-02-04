import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT } from "sequelize";

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
}
