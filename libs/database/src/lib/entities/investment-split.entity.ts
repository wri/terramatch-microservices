import { AutoIncrement, BelongsTo, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DECIMAL, STRING, UUID, UUIDV4 } from "sequelize";
import { Investment } from "./investment.entity";

@Table({ tableName: "investment_splits", underscored: true, paranoid: true })
export class InvestmentSplit extends Model<InvestmentSplit> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => Investment)
  @Column(BIGINT.UNSIGNED)
  investmentId: number;

  @BelongsTo(() => Investment)
  investment: Investment | null;

  @Column(STRING)
  funder: string;

  @Column(DECIMAL(15, 2))
  amount: number;
}
