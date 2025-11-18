import { AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  TEXT,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({ organisation: (orgUuid: string) => ({ where: { organisationId: orgUuid } }) }))
@Table({ tableName: "v2_ownership_stake", underscored: true, paranoid: true })
export class OwnershipStake extends Model<InferAttributes<OwnershipStake>, InferCreationAttributes<OwnershipStake>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\OwnershipStake";

  static organisation(orgUuid: string) {
    return chainScope(this, "organisation", orgUuid) as typeof OwnershipStake;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @Column({ type: UUID })
  organisationId: string;

  @Column(STRING)
  firstName: string;

  @Column(STRING)
  lastName: string;

  @Column(STRING)
  title: string;

  @Column(TEXT)
  gender: string;

  @Column(TINYINT)
  percentOwnership: number;

  @Column(INTEGER.UNSIGNED)
  yearOfBirth: number;
}
