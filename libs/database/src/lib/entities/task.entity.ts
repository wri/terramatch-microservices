import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  HasOne,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, STRING, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";
import { Project } from "./project.entity";
import { TaskStatus, TaskStatusStates } from "../constants/status";
import { getStateMachine, StateMachineColumn } from "../util/model-column-state-machine";
import { ProjectReport } from "./project-report.entity";
import { SiteReport } from "./site-report.entity";
import { NurseryReport } from "./nursery-report.entity";
import { SrpReport } from "./srp-report.entity";

@Table({ tableName: "v2_tasks", underscored: true, paranoid: true })
export class Task extends Model<Task> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Tasks\\Task";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number | null;

  @BelongsTo(() => Organisation, { constraints: false })
  organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name ?? "";
  }

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number | null;

  @BelongsTo(() => Project, { constraints: false })
  project: Project | null;

  get projectUuid() {
    return this.project?.uuid ?? "";
  }

  get projectName() {
    return this.project?.name ?? "";
  }

  get frameworkKey() {
    return this.project?.frameworkKey ?? "";
  }

  /** @deprecated this field is null for all rows in the production DB. */
  @AllowNull
  @Column(STRING)
  title: string | null;

  @StateMachineColumn(TaskStatusStates)
  status: TaskStatus;

  statusCanBe(status: TaskStatus) {
    return getStateMachine(this, "status")?.canBe(this.status, status) ?? false;
  }

  // Note: this column is marked nullable in the DB, but in fact no rows are null, and we should
  // make that a real constraint when the schema is controlled by v3 code.
  @Column(STRING)
  periodKey: string;

  // Note: this column is marked nullable in the DB, but in fact no rows are null, and we should
  // make that a real constraint when the schema is controlled by v3 code.
  @Column(DATE)
  dueAt: Date;

  @HasOne(() => ProjectReport)
  projectReport: ProjectReport | null;

  @HasMany(() => SiteReport)
  siteReports: SiteReport[] | null;

  @HasMany(() => NurseryReport)
  nurseryReports: NurseryReport[] | null;

  @HasMany(() => SrpReport)
  srpReports: SrpReport[] | null;
}
