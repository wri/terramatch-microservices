import { AutoIncrement, BelongsTo, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DECIMAL, STRING, UUID, UUIDV4 } from "sequelize";
import { Investment } from "./investment.entity";

@Table({ tableName: "investment_splits", underscored: true, paranoid: true })
export class InvestmentSplit extends Model<InvestmentSplit> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @ForeignKey(() => Investment)
  @Column(BIGINT.UNSIGNED)
  declare investmentId: number;

  @BelongsTo(() => Investment)
  declare investment: Investment | null;

  @Column(STRING)
  declare funder: string;

  @Column(DECIMAL(15, 2))
  declare amount: number;
}
