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
import { BIGINT, BOOLEAN, DATE, INTEGER, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Nursery } from "./nursery.entity";
import { TreeSpecies } from "./tree-species.entity";
import {
  AWAITING_APPROVAL,
  COMPLETE_REPORT_STATUSES,
  CompleteReportStatus,
  ReportStatus,
  ReportStatusStates,
  UpdateRequestStatus
} from "../constants/status";
import { FrameworkKey } from "../constants/framework";
import { Literal } from "sequelize/types/utils";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { User } from "./user.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { Task } from "./task.entity";
import { getStateMachine, StateMachineColumn } from "../util/model-column-state-machine";

@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  nurseries: (ids: number[] | Literal) => ({ where: { nurseryId: { [Op.in]: ids } } }),
  approved: { where: { status: { [Op.in]: NurseryReport.APPROVED_STATUSES } } },
  task: (taskId: number) => ({ where: { taskId } })
}))
@Table({ tableName: "v2_nursery_reports", underscored: true, paranoid: true })
export class NurseryReport extends Model<NurseryReport> {
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly PARENT_ID = "nurseryId";
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\NurseryReport";

  static readonly MEDIA = {
    file: { dbCollection: "file", multiple: true, validation: "general-documents" },
    otherAdditionalDocuments: {
      dbCollection: "other_additional_documents",
      multiple: true,
      validation: "general-documents"
    },
    treeSeedlingContributions: {
      dbCollection: "tree_seedling_contributions",
      multiple: true,
      validation: "general-documents"
    },
    photos: { dbCollection: "photos", multiple: true, validation: "photos" }
  } as const;

  static incomplete() {
    return chainScope(this, "incomplete") as typeof NurseryReport;
  }

  static nurseries(ids: number[] | Literal) {
    return chainScope(this, "nurseries", ids) as typeof NurseryReport;
  }

  static task(taskId: number) {
    return chainScope(this, "task", taskId) as typeof NurseryReport;
  }

  static approvedIdsSubquery(nurseryIds: number[] | Literal) {
    return Subquery.select(NurseryReport, "id")
      .in("nurseryId", nurseryIds)
      .in("status", NurseryReport.APPROVED_STATUSES).literal;
  }

  static approved() {
    return chainScope(this, "approved") as typeof NurseryReport;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @ForeignKey(() => Nursery)
  @Column(BIGINT.UNSIGNED)
  nurseryId: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  approvedBy: number;

  @BelongsTo(() => Nursery)
  nursery: Nursery | null;

  @BelongsTo(() => User)
  user: User | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  createdByUser: User | null;

  @BelongsTo(() => User, { foreignKey: "approvedBy", as: "approvedByUser" })
  approvedByUser: User | null;

  get projectName() {
    return this.nursery?.project?.name;
  }

  get projectUuid() {
    return this.nursery?.project?.uuid;
  }

  get organisationName() {
    return this.nursery?.project?.organisationName;
  }

  get organisationUuid() {
    return this.nursery?.project?.organisationUuid;
  }

  get nurseryName() {
    return this.nursery?.name;
  }

  get nurseryUuid() {
    return this.nursery?.uuid;
  }

  get taskUuid() {
    return this.task?.uuid;
  }

  get createdByFirstName() {
    return this.createdByUser?.firstName;
  }

  get createdByLastName() {
    return this.createdByUser?.lastName;
  }

  get approvedByFirstName() {
    return this.approvedByUser?.firstName;
  }

  get approvedByLastName() {
    return this.approvedByUser?.lastName;
  }

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  task: Task | null;

  @StateMachineColumn(ReportStatusStates)
  status: ReportStatus;

  get isComplete() {
    return COMPLETE_REPORT_STATUSES.includes(this.status as CompleteReportStatus);
  }

  /**
   * Returns true if the status is already one of `COMPLETE_REPORT_STATUSES`, or if it is legal to
   * transition to it.
   */
  get isCompletable() {
    return this.isComplete || getStateMachine(this, "status")?.canBe(this.status, AWAITING_APPROVAL);
  }

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seedlingsYoungTrees: number | null;

  @AllowNull
  @Column(BOOLEAN)
  nothingToReport: boolean;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(DATE)
  submittedAt: Date | null;

  @Column({ type: INTEGER, defaultValue: 0 })
  completion: number;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(TEXT)
  interestingFacts: string | null;

  @AllowNull
  @Column(TEXT)
  sitePrep: string | null;

  @AllowNull
  @Column(TEXT)
  sharedDriveLink: string | null;

  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number | null;

  @AllowNull
  @Column(TEXT("long"))
  answers: string | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: NurseryReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  seedlings: TreeSpecies[] | null;
}
