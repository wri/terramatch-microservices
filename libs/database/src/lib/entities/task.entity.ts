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
  Scopes,
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
import { chainScope } from "../util/chain-scope";
import { InternalServerErrorException } from "@nestjs/common";

@Scopes(() => ({
  project: (projectId: number) => ({ where: { projectId: projectId } }),
  dueAtDesc: () => ({ order: [["dueAt", "DESC"]] })
}))
@Table({ tableName: "v2_tasks", underscored: true, paranoid: true })
export class Task extends Model<Task> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Tasks\\Task";

  static forProject(projectId: number) {
    return chainScope(this, "project", projectId) as typeof Task;
  }

  static dueAtDesc() {
    return chainScope(this, "dueAtDesc") as typeof Task;
  }

  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("Task model is missing sequelize connection");
    }
    return this.sequelize;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number | null;

  @BelongsTo(() => Organisation, { constraints: false })
  declare organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name ?? "";
  }

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number | null;

  @BelongsTo(() => Project, { constraints: false })
  declare project: Project | null;

  get projectUuid(): string {
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
  declare title: string | null;

  @StateMachineColumn(TaskStatusStates)
  declare status: TaskStatus;

  statusCanBe(status: TaskStatus) {
    return getStateMachine(this, "status")?.canBe(this.status, status) ?? false;
  }

  // Note: this column is marked nullable in the DB, but in fact no rows are null, and we should
  // make that a real constraint when the schema is controlled by v3 code.
  @Column(STRING)
  declare periodKey: string;

  // Note: this column is marked nullable in the DB, but in fact no rows are null, and we should
  // make that a real constraint when the schema is controlled by v3 code.
  @Column(DATE)
  declare dueAt: Date;

  @HasOne(() => ProjectReport)
  declare projectReport: ProjectReport | null;

  @HasMany(() => SiteReport)
  declare siteReports: SiteReport[] | null;

  @HasMany(() => NurseryReport)
  declare nurseryReports: NurseryReport[] | null;

  @HasMany(() => SrpReport)
  declare srpReports: SrpReport[] | null;
}
