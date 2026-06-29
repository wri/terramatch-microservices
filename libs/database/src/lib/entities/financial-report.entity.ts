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
import { BIGINT, INTEGER, STRING, TEXT, DATE, UUID, UUIDV4, BOOLEAN } from "sequelize";
import { User } from "./user.entity";
import { ReportStatus, ReportStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { Organisation } from "./organisation.entity";
import { FinancialIndicator } from "./financial-indicator.entity";
import { Dictionary } from "lodash";
import { removeActions } from "../hooks/remove-actions";

@Scopes(() => ({
  organisation: (id: number) => ({ where: { organisationId: id } })
}))
@Table({
  tableName: "financial_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook, afterDestroy: removeActions }
})
export class FinancialReport extends Model<FinancialReport> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FinancialReport";

  static organisation(id: number) {
    return chainScope(this, "organisation", id) as typeof FinancialReport;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  linkToTerramatch(frontendUrl: string) {
    return `${frontendUrl}/admin#/financialReport/${this.uuid}/show`;
  }

  @StateMachineColumn(ReportStatusStates)
  declare status: ReportStatus;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number;

  @Column(STRING)
  declare title: string;

  @Column(INTEGER)
  declare yearOfReport: number;

  @AllowNull
  @Column(STRING)
  declare updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(BOOLEAN)
  declare nothingToReport: boolean | null;

  @AllowNull
  @Column(DATE)
  declare approvedAt: Date | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare approvedBy: number;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  @AllowNull
  @Column(DATE)
  declare submittedAt: Date | null;

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @AllowNull
  @Column(DATE)
  declare dueAt: Date | null;

  @Column({ type: INTEGER, defaultValue: 0 })
  declare completion: number;

  @AllowNull
  @Column(TEXT)
  declare feedback: string | null;

  @AllowNull
  @JsonColumn()
  declare feedbackFields: string[] | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  declare answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(INTEGER)
  declare finStartMonth: number | null;

  @AllowNull
  @Column(STRING)
  declare currency: string | null;

  @BelongsTo(() => Organisation)
  declare organisation: Organisation | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  declare createdByUser: User | null;

  @HasMany(() => FinancialIndicator, {
    foreignKey: "financialReportId",
    constraints: false
  })
  declare financialIndicators: FinancialIndicator[] | null;

  get organisationName() {
    return this.organisation?.name;
  }

  get organisationUuid(): string | undefined {
    return this.organisation?.uuid;
  }

  get organisationType() {
    return this.organisation?.type;
  }

  get organisationStatus() {
    return this.organisation?.status;
  }

  get createdByFirstName() {
    return this.createdByUser?.firstName;
  }

  get createdByLastName() {
    return this.createdByUser?.lastName;
  }

  get isCompletable() {
    return this.status !== "started";
  }

  get isComplete() {
    return this.status === "approved";
  }
}
