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
  CreationOptional,
  DECIMAL,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
  SMALLINT,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { FinancialReport } from "./financial-report.entity";
import { chainScope } from "../util/chain-scope";
import { MediaConfiguration } from "../constants/media-owners";
import { Organisation } from "./organisation.entity";
import { removeMedia } from "../hooks/remove-media";

type FinancialIndicatorMedia = "documentation";

@Scopes(() => ({
  financialReport: (id: number) => ({ where: { financialReportId: id } }),
  organisation: (id: number) => ({ where: { organisationId: id, financialReportId: null } })
}))
@Table({ tableName: "financial_indicators", underscored: true, paranoid: true, hooks: { afterDestroy: removeMedia } })
export class FinancialIndicator extends Model<
  InferAttributes<FinancialIndicator>,
  InferCreationAttributes<FinancialIndicator>
> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FinancialIndicators";

  static financialReport(id: number) {
    return chainScope(this, "financialReport", id) as typeof FinancialIndicator;
  }

  static organisation(id: number) {
    return chainScope(this, "organisation", id) as typeof FinancialIndicator;
  }

  static readonly MEDIA: Record<FinancialIndicatorMedia, MediaConfiguration> = {
    documentation: { dbCollection: "documentation", multiple: true, validation: "general-documents" }
  };

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number;

  @ForeignKey(() => FinancialReport)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare financialReportId: number | null;

  @Column(SMALLINT.UNSIGNED)
  declare year: number;

  @Column(STRING)
  declare collection: string;

  @AllowNull
  @Column(DECIMAL(15, 2))
  declare amount: number | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @Column(DECIMAL(15, 2))
  declare exchangeRate: number | null;

  @BelongsTo(() => Organisation)
  declare organisation: NonAttribute<Organisation | null>;

  @BelongsTo(() => FinancialReport)
  declare financialReport: NonAttribute<FinancialReport | null>;
}
