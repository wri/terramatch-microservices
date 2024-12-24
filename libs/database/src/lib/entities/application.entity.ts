import { AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, UUID } from "sequelize";
import { User } from "./user.entity";

@Table({ tableName: "applications", underscored: true, paranoid: true })
export class Application extends Model<Application> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Index
  @Column(UUID)
  fundingProgrammeUuid: string | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  updatedBy: number | null;
}
