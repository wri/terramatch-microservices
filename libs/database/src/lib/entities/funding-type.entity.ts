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
import {
  BIGINT,
  INTEGER,
  STRING,
  TEXT,
  UUIDV4,
  UUID,
  InferCreationAttributes,
  CreationOptional,
  InferAttributes,
  NonAttribute
} from "sequelize";
import { chainScope } from "../util/chain-scope";
import { Organisation } from "./organisation.entity";
import { FinancialReport } from "./financial-report.entity";

@Scopes(() => ({
  organisation: (uuid: string) => ({ where: { organisationId: uuid, financialReportId: null } }),
  financialReport: (id: number) => ({ where: { financialReportId: id } })
}))
@Table({ tableName: "v2_funding_types", underscored: true, paranoid: true })
export class FundingType extends Model<InferAttributes<FundingType>, InferCreationAttributes<FundingType>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FundingType";

  static organisation(uuid: string) {
    return chainScope(this, "organisation", uuid) as typeof FundingType;
  }

  static financialReport(id: number) {
    return chainScope(this, "financialReport", id) as typeof FundingType;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

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

  @AllowNull
  @ForeignKey(() => FinancialReport)
  @Column(BIGINT.UNSIGNED)
  financialReportId: number | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationId", targetKey: "uuid" })
  organisation: NonAttribute<Organisation>;

  get organisationName(): NonAttribute<string | undefined> {
    return this.organisation?.name ?? undefined;
  }

  get organisationUuid(): NonAttribute<string> {
    return this.organisationId;
  }
}
