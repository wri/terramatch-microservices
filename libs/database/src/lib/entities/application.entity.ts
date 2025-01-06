import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, UUID } from "sequelize";
import { User } from "./user.entity";

@Table({
  tableName: "applications",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names
  indexes: [{ name: "applications_funding_programme_uuid_index", fields: ["funding_programme_uuid"] }]
})
export class Application extends Model<Application> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column(UUID)
  fundingProgrammeUuid: string | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  updatedBy: number | null;
}
