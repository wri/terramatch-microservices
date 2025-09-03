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
import { Project } from "./project.entity";
import { ReportStatus, ReportStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { Organisation } from "./organisation.entity";

@Scopes(() => ({
  organisation: (id: number) => ({ where: { organisationId: id } })
}))
@Table({
  tableName: "disturbance_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class DisturbanceReport extends Model<DisturbanceReport> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\DisturbanceReport";

  static organisation(id: number) {
    return chainScope(this, "organisation", id);
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
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(DATE)
  dateOfIncident: Date | null;

  @AllowNull
  @Column(STRING)
  intensity: string | null;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(BOOLEAN)
  nothingToReport: boolean | null;

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

  @BelongsTo(() => Project)
  project: Project;

  @BelongsTo(() => User, { foreignKey: "createdBy" })
  createdByUser: User;

  @BelongsTo(() => User, { foreignKey: "approvedBy" })
  approvedByUser: User;

  get organisationId() {
    return this.project?.organisationId;
  }

  get organisationName() {
    return this.project?.organisation?.name;
  }

  get organisationUuid() {
    return this.project?.organisation?.uuid;
  }

  get organisationType() {
    return this.project?.organisation?.type;
  }

  get organisationStatus() {
    return this.project?.organisation?.status;
  }

  get projectName() {
    return this.project?.name;
  }

  get projectUuid() {
    return this.project?.uuid;
  }
}
