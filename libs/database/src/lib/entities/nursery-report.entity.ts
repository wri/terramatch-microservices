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
import { BIGINT, DATE, INTEGER, Op, STRING, TEXT, TINYINT, UUID } from "sequelize";
import { Nursery } from "./nursery.entity";
import { TreeSpecies } from "./tree-species.entity";
import { COMPLETE_REPORT_STATUSES, ReportStatus, UpdateRequestStatus } from "../constants/status";
import { FrameworkKey } from "../constants/framework";
import { Literal } from "sequelize/types/utils";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { User } from "./user.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { Task } from "./task.entity";

// Incomplete stub
@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  nurseries: (ids: number[] | Literal) => ({ where: { nurseryId: { [Op.in]: ids } } }),
  approved: { where: { status: { [Op.in]: NurseryReport.APPROVED_STATUSES } } },
  task: (taskId: number) => ({ where: { taskId: taskId } })
}))
@Table({ tableName: "v2_nursery_reports", underscored: true, paranoid: true })
export class NurseryReport extends Model<NurseryReport> {
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly PARENT_ID = "nurseryId";
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\NurseryReport";

  static readonly MEDIA = {
    file: { dbCollection: "file", multiple: true },
    otherAdditionalDocuments: { dbCollection: "other_additional_documents", multiple: true },
    treeSeedlingContributions: { dbCollection: "tree_seedling_contributions", multiple: true },
    photos: { dbCollection: "photos", multiple: true }
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
  @Column(UUID)
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

  @BelongsTo(() => Task)
  task: Task | null;

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

  @Column(STRING)
  status: ReportStatus;

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
  @Column(TINYINT)
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

  @AllowNull
  @Column(INTEGER)
  completion: number | null;

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
