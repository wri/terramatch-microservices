import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DECIMAL, STRING, TEXT, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "financial_indicators", underscored: true, paranoid: true })
export class FinancialIndicator extends Model<FinancialIndicator> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @Column(STRING)
  collection: string;

  @AllowNull
  @Column(DECIMAL(15, 2))
  amount: number | null;

  @Column(TEXT)
  description: string | null;
}
