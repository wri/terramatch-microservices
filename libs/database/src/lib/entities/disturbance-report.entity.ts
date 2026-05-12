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
import { removeMedia } from "../hooks/remove-media";

type DisturbanceReportMedia = "media";

@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({
  tableName: "disturbance_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook, afterDestroy: removeMedia }
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
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

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

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare approvedBy: number | null;

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
  declare completion: CreationOptional<number>;

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
  declare description: string | null;

  @AllowNull
  @Column(TEXT)
  declare actionDescription: string | null;

  @BelongsTo(() => Project)
  declare project: Project | null;

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
