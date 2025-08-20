import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, CHAR, DATE, UUIDV4, UUID } from "sequelize";
import { chainScope } from "../util/chain-scope";
import { Organisation } from "./organisation.entity";

@Scopes(() => ({
  organisation: (id: number) => ({ where: { organisationId: id } }),
  organisationByUuid: (uuid: string) => ({ where: { organisationId: uuid } })
}))
@Table({
  tableName: "v2_funding_types",
  underscored: true,
  paranoid: true
})
export class FundingType extends Model<FundingType> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FundingType";

  static organisation(id: number) {
    return chainScope(this, "organisation", id) as typeof FundingType;
  }

  static organisationByUuid(uuid: string) {
    return chainScope(this, "organisationByUuid", uuid) as typeof FundingType;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => Organisation)
  @Column(CHAR(36))
  organisationId: string;

  @AllowNull
  @Column(DATE)
  override deletedAt: Date | null;

  @Column(DATE)
  override createdAt: Date;

  @Column(DATE)
  override updatedAt: Date;

  @AllowNull
  @Column(STRING)
  source: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  amount: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  year: number | null;

  @AllowNull
  @Column(TEXT)
  type: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationId", targetKey: "uuid" })
  organisation: Organisation;

  get organisationName() {
    return this.organisation.name;
  }

  get organisationUuid() {
    return this.organisation.uuid;
  }
}
