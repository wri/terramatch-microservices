import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";
import { Organisation } from "./organisation.entity";
import { User } from "./user.entity";
import { OrganisationJoinRequestStatus } from "../constants/status";

/**
 * A user's request to join an organisation. Membership itself lives on users.organisation_id; a request
 * only exists while it is pending, or after it has been rejected (which includes members who were removed).
 * Approving a request sets the user's organisation and deletes the request.
 */
@Table({ tableName: "organisation_join_requests", underscored: true, timestamps: false })
export class OrganisationJoinRequest extends Model<
  InferAttributes<OrganisationJoinRequest>,
  InferCreationAttributes<OrganisationJoinRequest>
> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number;

  @Column(STRING(30))
  declare status: OrganisationJoinRequestStatus;

  @BelongsTo(() => Organisation)
  declare organisation: Organisation | null;
}
