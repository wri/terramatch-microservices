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
import { BIGINT, INTEGER, STRING, TEXT, DATE, UUID, UUIDV4, BOOLEAN } from "sequelize";
import { User } from "./user.entity";
import { ReportStatus, ReportStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { Project } from "./project.entity";
import { Task } from "./task.entity";
import { MediaConfiguration } from "../constants/media-owners";

type SrpReportMedia = "media";

@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } }),
  task: (taskId: number) => ({ where: { taskId } })
}))
@Table({
  tableName: "srp_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class SrpReport extends Model<SrpReport> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\SrpReport";
  static readonly MEDIA: Record<SrpReportMedia, MediaConfiguration> = {
    media: { dbCollection: "media", multiple: true, validation: "general-documents" }
  };

  static project(id: number) {
    return chainScope(this, "project", id) as typeof SrpReport;
  }

  static task(taskId: number) {
    return chainScope(this, "task", taskId) as typeof SrpReport;
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

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(BOOLEAN)
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

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  task: Task | null;

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
  @JsonColumn({ type: TEXT("long") })
  answers: object | null;

  @AllowNull
  @Column(TEXT)
  otherRestorationPartnersDescription: string | null;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  totalUniqueRestorationPartners: number;

  @Column(INTEGER)
  year: number;

  @BelongsTo(() => Project)
  project: Project | null;

  get projectName() {
    return this.project?.name;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  get organisationUuid() {
    return this.project?.organisation?.uuid;
  }

  get projectUuid() {
    return this.project?.uuid;
  }

  get projectStatus() {
    return this.project?.status;
  }

  get taskUuid() {
    return this.task?.uuid;
  }

  get isCompletable() {
    return this.status !== "started";
  }

  get isComplete() {
    return this.status === "approved";
  }
}
