import { AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "v2_ownership_stake", underscored: true, paranoid: true })
export class OwnershipStake extends Model<OwnershipStake> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\OwnershipStake";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

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
