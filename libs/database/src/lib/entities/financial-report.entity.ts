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
import { BIGINT, DATE, INTEGER, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Project } from "./project.entity";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { ReportStatus, ReportStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { Organisation } from "./organisation.entity";

@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } }),
  organisation: (uuid: string) => ({
    include: [
      {
        association: "project",
        include: [{ association: "organisation", where: { uuid } }]
      }
    ]
  })
}))
@Table({
  tableName: "v2_financial_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class FinancialReport extends Model<FinancialReport> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\FinancialReports\\FinancialReport";

  static organisation(uuid: string) {
    return chainScope(this, "organisation", uuid) as typeof FinancialReport;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @StateMachineColumn(ReportStatusStates)
  status: ReportStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @Column(DATE)
  startDate: Date | null;

  @AllowNull
  @Column(DATE)
  endDate: Date | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(INTEGER)
  yearOfReport: number | null;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @AllowNull
  @Column(DATE)
  submittedAt: Date | null;

  @AllowNull
  @Column(TEXT)
  title: string | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @JsonColumn()
  tags: string[] | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(INTEGER)
  completion: number | null;

  @AllowNull
  @Column({ type: STRING, values: ["true", "false"] })
  nothingToReport: boolean | null;

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number | null;

  @BelongsTo(() => Task, { constraints: false })
  task: Task | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  approvedBy: number;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  createdByUser: User | null;

  @BelongsTo(() => User, { foreignKey: "approvedBy", as: "approvedByUser" })
  approvedByUser: User | null;

  @BelongsTo(() => Organisation)
  organisation: Organisation;

  get organisationName() {
    return this.organisation.name;
  }

  get organisationUuid() {
    return this.organisation.uuid;
  }

  get isCompletable() {
    return this.status !== "started";
  }

  get isComplete() {
    return this.status === "approved";
  }
}
