import { BIGINT, STRING } from "sequelize";
import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { User } from "./user.entity";

@Table({ tableName: "password_resets", underscored: true })
export class PasswordReset extends Model<PasswordReset> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  token: string;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  userId: number;

  @BelongsTo(() => User)
  user: User;
}
