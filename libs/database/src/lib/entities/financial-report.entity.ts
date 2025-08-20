import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, CHAR, TINYINT, DATE, UUID, UUIDV4 } from "sequelize";
import { User } from "./user.entity";
import { ReportStatus, ReportStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { Organisation } from "./organisation.entity";
import { FinancialIndicator } from "./financial-indicator.entity";

@Scopes(() => ({
  organisation: (id: number) => ({ where: { organisationId: id } })
}))
@Table({
  tableName: "financial_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class FinancialReport extends Model<FinancialReport> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FinancialReport";

  static organisation(id: number) {
    return chainScope(this, "organisation", id) as typeof FinancialReport;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @StateMachineColumn(ReportStatusStates)
  @Column(STRING)
  status: ReportStatus;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(INTEGER)
  yearOfReport: number | null;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(TINYINT)
  nothingToReport: boolean | null;

  @AllowNull
  @Column(DATE)
  approvedAt: Date | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  approvedBy: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number;

  @AllowNull
  @Column(DATE)
  submittedAt: Date | null;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @Column({ type: INTEGER, defaultValue: 0 })
  completion: number;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(TEXT("long"))
  answers: string | null;

  @AllowNull
  @Column(INTEGER)
  finStartMonth: number | null;

  @AllowNull
  @Column(STRING)
  currency: string | null;

  @AllowNull
  @Column(DATE)
  override deletedAt: Date | null;

  @Column(DATE)
  override createdAt: Date;

  @Column(DATE)
  override updatedAt: Date;

  @BelongsTo(() => Organisation, { foreignKey: "organisationId" })
  organisation: Organisation;

  @HasMany(() => FinancialIndicator, {
    foreignKey: "financialReportId",
    constraints: false
  })
  financialCollection: FinancialIndicator[] | null;

  get organisationName() {
    return this.organisation.name;
  }

  get organisationUuid() {
    return this.organisation.uuid;
  }

  get organisationType() {
    return this.organisation.type;
  }

  get organisationStatus() {
    return this.organisation.status;
  }

  get isCompletable() {
    return this.status !== "started";
  }

  get isComplete() {
    return this.status === "approved";
  }
}
