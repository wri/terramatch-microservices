import { AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING } from "sequelize";
import { Organisation } from "./organisation.entity";
import { User } from "./user.entity";

@Table({ tableName: "organisation_user", underscored: true, timestamps: false })
export class OrganisationUser extends Model<OrganisationUser> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number;

  @Column(STRING(20))
  declare status: string;
}
