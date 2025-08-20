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
import { BIGINT, DECIMAL, SMALLINT, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { FinancialReport } from "./financial-report.entity";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  financialReport: (id: number) => ({ where: { financialReportId: id } })
}))
@Table({ tableName: "financial_indicators", underscored: true, paranoid: true })
export class FinancialIndicator extends Model<FinancialIndicator> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FinancialIndicators";

  static financialReport(id: number) {
    return chainScope(this, "financialReport", id) as typeof FinancialIndicator;
  }

  static readonly MEDIA = {
    documentation: { dbCollection: "documentation", multiple: true, validation: "general-documents" }
  } as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @ForeignKey(() => FinancialReport)
  @Column(BIGINT.UNSIGNED)
  financialReportId: number;

  @Column(SMALLINT.UNSIGNED)
  year: number;

  @Column(STRING)
  collection: string;

  @AllowNull
  @Column(DECIMAL(15, 2))
  amount: number | null;

  @Column(TEXT)
  description: string | null;

  @Column(DECIMAL(15, 2))
  exchangeRate: number | null;

  @BelongsTo(() => FinancialReport)
  financialReport: FinancialReport;
}
