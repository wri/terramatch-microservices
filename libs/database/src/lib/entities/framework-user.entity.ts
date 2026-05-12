import { AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT } from "sequelize";
import { Framework } from "./framework.entity";
import { User } from "./user.entity";

@Table({ tableName: "framework_user", underscored: true })
export class FrameworkUser extends Model<FrameworkUser> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @ForeignKey(() => Framework)
  @Column(BIGINT.UNSIGNED)
  declare frameworkId: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;
}
