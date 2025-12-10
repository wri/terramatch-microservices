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
  BOOLEAN,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  NonAttribute,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { User } from "./user.entity";
import { ReportStatus, ReportStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { Project } from "./project.entity";
import { MediaConfiguration } from "../constants/media-owners";
import { Dictionary } from "lodash";

type DisturbanceReportMedia = "media";

@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({
  tableName: "disturbance_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class DisturbanceReport extends Model<
  InferAttributes<DisturbanceReport>,
  InferCreationAttributes<DisturbanceReport>
> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\DisturbanceReport";
  static readonly MEDIA: Record<DisturbanceReportMedia, MediaConfiguration> = {
    media: { dbCollection: "media", multiple: true, validation: "general-documents" }
  };

  static project(id: number) {
    return chainScope(this, "project", id) as typeof DisturbanceReport;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

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

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  approvedBy: number | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

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
  completion: CreationOptional<number>;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(TEXT)
  actionDescription: string | null;

  @BelongsTo(() => Project)
  project: Project | null;

  get projectName() {
    return this.project?.name ?? undefined;
  }

  get projectUuid(): string | undefined {
    return this.project?.uuid;
  }

  get organisationName() {
    return this.project?.organisationName ?? undefined;
  }

  get organisationUuid() {
    return this.project?.organisationUuid ?? undefined;
  }

  get isCompletable(): NonAttribute<boolean> {
    return this.status !== "started";
  }

  get isComplete(): NonAttribute<boolean> {
    return this.status === "approved";
  }
}
