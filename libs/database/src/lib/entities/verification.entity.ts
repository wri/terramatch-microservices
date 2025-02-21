import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING } from "sequelize";
import { User } from "./user.entity";

@Table({ tableName: "verifications", underscored: true })
export class Verification extends Model<Verification> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  token: string | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  userId: number;

  @BelongsTo(() => User)
  user: User | null;
}
