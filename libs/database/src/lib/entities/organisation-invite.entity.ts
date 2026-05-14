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
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number;

  @Column(STRING)
  declare emailAddress: string;

  @AllowNull
  @Column(STRING)
  declare token: string | null;

  @AllowNull
  @Column(DATE)
  declare acceptedAt: Date | null;

  @BelongsTo(() => Organisation)
  declare organisation: Organisation | null;

  @BelongsTo(() => User, { foreignKey: "emailAddress", targetKey: "emailAddress" })
  declare user: User | null;
}
