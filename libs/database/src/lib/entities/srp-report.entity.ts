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
import { Dictionary } from "lodash";
import { removeActions } from "../hooks/remove-actions";

type SrpReportMedia = "media";

@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } }),
  task: (taskId: number) => ({ where: { taskId } })
}))
@Table({
  tableName: "srp_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook, afterDestroy: removeActions }
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
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @StateMachineColumn(ReportStatusStates)
  declare status: ReportStatus;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

  @AllowNull
  @Column(STRING)
  declare title: string | null;

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

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  declare task: Task | null;

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
  @Column(TEXT)
  declare restorationPartnersDescription: string | null;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  declare totalUniqueRestorationPartners: number;

  @Column(INTEGER)
  declare year: number;

  @BelongsTo(() => Project)
  declare project: Project | null;

  get projectName() {
    return this.project?.name;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  get organisationUuid(): string | undefined {
    return this.project?.organisation?.uuid;
  }

  get projectUuid(): string | undefined {
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
