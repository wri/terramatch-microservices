import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING } from "sequelize";
import { User } from "./user.entity";

@Table({ tableName: "verifications", underscored: true })
export class Verification extends Model<Verification> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Column(STRING)
  declare token: string | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @BelongsTo(() => User)
  declare user: User | null;
}
