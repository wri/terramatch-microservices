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
import { BIGINT, INTEGER, STRING, TEXT, UUIDV4, UUID } from "sequelize";
import { chainScope } from "../util/chain-scope";
import { Organisation } from "./organisation.entity";
import { FinancialReport } from "./financial-report.entity";

@Scopes(() => ({
  organisationByUuid: (uuid: string) => ({ where: { organisationId: uuid } }),
  financialReport: (id: number) => ({ where: { financialReportId: id } })
}))
@Table({
  tableName: "v2_funding_types",
  underscored: true,
  paranoid: true
})
export class FundingType extends Model<FundingType> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FundingType";

  static organisationByUuid(uuid: string) {
    return chainScope(this, "organisationByUuid", uuid) as typeof FundingType;
  }

  static financialReport(id: number) {
    return chainScope(this, "financialReport", id) as typeof FundingType;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column({ type: UUID, defaultValue: UUIDV4 })
  organisationId: string;

  @AllowNull
  @Column(STRING)
  source: string | null;

  @Column(INTEGER.UNSIGNED)
  amount: number;

  @Column(INTEGER.UNSIGNED)
  year: number;

  @Column(TEXT)
  type: string;

  @ForeignKey(() => FinancialReport)
  @Column(BIGINT.UNSIGNED)
  financialReportId: number;

  @BelongsTo(() => Organisation, { foreignKey: "organisationId", targetKey: "uuid" })
  organisation: Organisation;

  get organisationName() {
    return this.organisation.name;
  }

  get organisationUuid() {
    return this.organisation.uuid;
  }
}
