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
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  NonAttribute,
  Op,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { Nursery } from "./nursery.entity";
import { TreeSpecies } from "./tree-species.entity";
import {
  AWAITING_APPROVAL,
  COMPLETE_REPORT_STATUSES,
  CompleteReportStatus,
  ReportStatus,
  ReportStatusStates,
  statusUpdateSequelizeHook,
  UpdateRequestStatus
} from "../constants/status";
import { FrameworkKey } from "../constants";
import { Literal } from "sequelize/types/utils";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { User } from "./user.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { Task } from "./task.entity";
import { getStateMachine, StateMachineColumn } from "../util/model-column-state-machine";
import { MediaConfiguration } from "../constants/media-owners";
import { Dictionary } from "lodash";
import { removeMedia } from "../hooks/remove-media";
import { removeActions } from "../hooks/remove-actions";

type NurseryReportMedia = "media" | "file" | "otherAdditionalDocuments" | "treeSeedlingContributions" | "photos";

@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  nurseries: (ids: number[] | Literal) => ({ where: { nurseryId: { [Op.in]: ids } } }),
  approved: { where: { status: { [Op.in]: NurseryReport.APPROVED_STATUSES } } },
  task: (taskId: number) => ({ where: { taskId } })
}))
@Table({
  tableName: "v2_nursery_reports",
  underscored: true,
  paranoid: true,
  hooks: {
    afterCreate: statusUpdateSequelizeHook,
    afterDestroy: async (report: NurseryReport) => {
      await removeMedia(report);
      await removeActions(report);
    }
  }
})
export class NurseryReport extends Model<InferAttributes<NurseryReport>, InferCreationAttributes<NurseryReport>> {
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly PARENT_ID = "nurseryId";
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\NurseryReport";

  static readonly MEDIA: Record<NurseryReportMedia, MediaConfiguration> = {
    media: { dbCollection: "media", multiple: true, validation: "general-documents" },
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
  };

  static incomplete() {
    return chainScope(this, "incomplete") as typeof NurseryReport;
  }

  static nurseries(ids: number[] | Literal) {
    return chainScope(this, "nurseries", ids) as typeof NurseryReport;
  }

  static idsSubquery(nurseryIds: number[] | Literal) {
    return Subquery.select(NurseryReport, "id").in("nurseryId", nurseryIds).literal;
  }

  static uuidsSubquery(nurseryIds: number[] | Literal) {
    return Subquery.select(NurseryReport, "uuid").in("nurseryId", nurseryIds).literal;
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
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  linkToTerramatch(frontendUrl: string) {
    return `${frontendUrl}/admin#/nurseryReport/${this.uuid}/show`;
  }

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @ForeignKey(() => Nursery)
  @Column(BIGINT.UNSIGNED)
  declare nurseryId: number;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare approvedBy: number | null;

  @BelongsTo(() => Nursery)
  declare nursery: Nursery | null;

  @BelongsTo(() => User)
  declare user: User | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  declare createdByUser: User | null;

  @BelongsTo(() => User, { foreignKey: "approvedBy", as: "approvedByUser" })
  declare approvedByUser: User | null;

  get projectName() {
    return this.nursery?.project?.name;
  }

  get projectUuid(): string | undefined {
    return this.nursery?.project?.uuid;
  }

  get projectExportId(): number | undefined {
    return this.nursery?.project?.exportId;
  }

  get organisationName() {
    return this.nursery?.project?.organisationName;
  }

  get organisationUuid() {
    return this.nursery?.project?.organisationUuid;
  }

  get organisationReadableType() {
    return this.nursery?.project?.organisationReadableType;
  }

  get nurseryName() {
    return this.nursery?.name;
  }

  get nurseryUuid(): string | undefined {
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
  declare taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  declare task: Task | null;

  @StateMachineColumn(ReportStatusStates)
  declare status: CreationOptional<ReportStatus>;

  get isComplete(): NonAttribute<boolean> {
    return COMPLETE_REPORT_STATUSES.includes(this.status as CompleteReportStatus);
  }

  /**
   * Returns true if the status is already one of `COMPLETE_REPORT_STATUSES`, or if it is legal to
   * transition to it.
   */
  get isCompletable(): NonAttribute<boolean> {
    return (this.isComplete || getStateMachine(this, "status")?.canBe(this.status, AWAITING_APPROVAL)) ?? false;
  }

  @AllowNull
  @Column(STRING)
  declare updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(DATE)
  declare dueAt: Date | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seedlingsYoungTrees: number | null;

  @AllowNull
  @Column(BOOLEAN)
  declare nothingToReport: boolean | null;

  @AllowNull
  @Column(TEXT)
  declare feedback: string | null;

  @AllowNull
  @JsonColumn()
  declare feedbackFields: string[] | null;

  @AllowNull
  @Column(DATE)
  declare submittedAt: Date | null;

  @Column({ type: INTEGER, defaultValue: 0 })
  declare completion: CreationOptional<number>;

  @AllowNull
  @Column(STRING)
  declare title: string | null;

  @AllowNull
  @Column(TEXT)
  declare interestingFacts: string | null;

  @AllowNull
  @Column(TEXT)
  declare sitePrep: string | null;

  @AllowNull
  @Column(TEXT)
  declare sharedDriveLink: string | null;

  @AllowNull
  @Column(STRING)
  declare oldModel: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare oldId: number | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  declare answers: Dictionary<unknown> | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: NurseryReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  declare seedlings: TreeSpecies[] | null;
}
