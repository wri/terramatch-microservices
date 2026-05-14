import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";
import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { User } from "./user.entity";

@Table({ tableName: "password_resets", underscored: true })
export class PasswordReset extends Model<InferAttributes<PasswordReset>, InferCreationAttributes<PasswordReset>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Column(STRING)
  declare token: string;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @BelongsTo(() => User)
  declare user: User | null;
}
