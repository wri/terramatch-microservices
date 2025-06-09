import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";

@Table({ tableName: "financial_indicators", underscored: true, paranoid: true })
export class FinancialIndicator extends Model<FinancialIndicator> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FinancialIndicator";

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

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  // TODO: complete remaining fields
}
