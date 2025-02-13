import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING } from "sequelize";

@Table({ tableName: "verifications", underscored: true })
export class Verification extends Model<Verification> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  token: string | null;

  @Column(BIGINT.UNSIGNED)
  userId: number;
}
