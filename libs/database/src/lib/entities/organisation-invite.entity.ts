import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { Organisation } from "./organisation.entity";
import { User } from "./user.entity";

@Table({ tableName: "v2_organisation_invites", underscored: true })
export class OrganisationInvite extends Model<
  InferAttributes<OrganisationInvite>,
  InferCreationAttributes<OrganisationInvite>
> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @Column(STRING)
  emailAddress: string;

  @AllowNull
  @Column(STRING)
  token: string | null;

  @AllowNull
  @Column(DATE)
  acceptedAt: Date | null;

  @BelongsTo(() => Organisation)
  organisation: Organisation | null;

  @BelongsTo(() => User, { foreignKey: "emailAddress", targetKey: "emailAddress" })
  user: User | null;
}
