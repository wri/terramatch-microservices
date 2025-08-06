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
import { TreeSpecies } from "./tree-species.entity";
import { Site } from "./site.entity";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants";
import { Literal } from "sequelize/types/utils";
import {
  AWAITING_APPROVAL,
  COMPLETE_REPORT_STATUSES,
  CompleteReportStatus,
  ReportStatus,
  ReportStatusStates,
  statusUpdateSequelizeHook,
  UpdateRequestStatus
} from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { Task } from "./task.entity";
import { User } from "./user.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { getStateMachine, StateMachineColumn } from "../util/model-column-state-machine";

type ApprovedIdsSubqueryOptions = {
  dueAfter?: string | Date;
  dueBefore?: string | Date;
};

@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  sites: (ids: number[] | Literal) => ({ where: { siteId: { [Op.in]: ids } } }),
  approved: { where: { status: { [Op.in]: SiteReport.APPROVED_STATUSES } } },
  dueBefore: (date: Date | string) => ({ where: { dueAt: { [Op.lt]: date } } }),
  task: (taskId: number) => ({ where: { taskId } })
}))
@Table({
  tableName: "v2_site_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class SiteReport extends Model<SiteReport> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly PARENT_ID = "siteId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly UNSUBMITTED_STATUSES = ["due", "started"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\SiteReport";

  static readonly MEDIA = {
    socioeconomicBenefits: { dbCollection: "socioeconomic_benefits", multiple: true, validation: "general-documents" },
    media: { dbCollection: "media", multiple: true, validation: "general-documents" },
    file: { dbCollection: "file", multiple: true, validation: "general-documents" },
    otherAdditionalDocuments: {
      dbCollection: "other_additional_documents",
      multiple: true,
      validation: "general-documents"
    },
    photos: { dbCollection: "photos", multiple: true, validation: "photos" },
    treeSpecies: { dbCollection: "tree_species", multiple: true, validation: "general-documents" },
    siteSubmission: { dbCollection: "site_submission", multiple: true, validation: "general-documents" },
    documentFiles: { dbCollection: "document_files", multiple: true, validation: "general-documents" },
    treePlantingUpload: { dbCollection: "tree_planting_upload", multiple: true, validation: "general-documents" },
    anrPhotos: { dbCollection: "anr_photos", multiple: true, validation: "photos" },
    soilWaterConservationUpload: {
      dbCollection: "soil_water_conservation_upload",
      multiple: true,
      validation: "general-documents"
    },
    soilWaterConservationPhotos: {
      dbCollection: "soil_water_conservation_photos",
      multiple: true,
      validation: "photos"
    }
  } as const;

  static incomplete() {
    return chainScope(this, "incomplete") as typeof SiteReport;
  }

  static sites(ids: number[] | Literal) {
    return chainScope(this, "sites", ids) as typeof SiteReport;
  }

  static approved() {
    return chainScope(this, "approved") as typeof SiteReport;
  }

  static dueBefore(date: Date | string) {
    return chainScope(this, "dueBefore", date) as typeof SiteReport;
  }

  static task(taskId: number) {
    return chainScope(this, "task", taskId) as typeof SiteReport;
  }

  static approvedIdsSubquery(siteIds: number[] | Literal, opts: ApprovedIdsSubqueryOptions = {}) {
    const builder = Subquery.select(SiteReport, "id").in("siteId", siteIds).in("status", SiteReport.APPROVED_STATUSES);
    if (opts.dueAfter != null) builder.gte("dueAt", opts.dueAfter);
    if (opts.dueBefore != null) builder.lt("dueAt", opts.dueBefore);
    return builder.literal;
  }

  static approvedIdsForTaskSubquery(taskId: number) {
    return Subquery.select(SiteReport, "id").eq("taskId", taskId).in("status", SiteReport.APPROVED_STATUSES).literal;
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

  @ForeignKey(() => Site)
  @Column(BIGINT.UNSIGNED)
  siteId: number;

  @BelongsTo(() => Site)
  site: Site | null;

  @BelongsTo(() => User)
  user: User | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  createdByUser: User | null;

  @BelongsTo(() => User, { foreignKey: "approvedBy", as: "approvedByUser" })
  approvedByUser: User | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  approvedBy: number;

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  task: Task | null;

  get projectName() {
    return this.site?.project?.name;
  }

  get projectUuid() {
    return this.site?.project?.uuid;
  }

  get organisationName() {
    return this.site?.project?.organisationName;
  }

  get organisationUuid() {
    return this.site?.project?.organisationUuid;
  }

  get siteName() {
    return this.site?.name;
  }

  get siteUuid() {
    return this.site?.uuid;
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
  @Column(DATE)
  submittedAt: Date | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  workdaysPaid: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  workdaysVolunteer: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  pctSurvivalToDate: number | null;

  @AllowNull
  @Column(TEXT)
  survivalCalculation: string | null;

  @AllowNull
  @Column(TEXT)
  survivalDescription: string | null;

  @AllowNull
  @Column(TEXT)
  maintenanceActivities: string | null;

  @AllowNull
  @Column(TEXT)
  regenerationDescription: string | null;

  @AllowNull
  @Column(TEXT)
  technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  publicNarrative: string | null;

  @AllowNull
  @Column(INTEGER)
  numTreesRegenerating: number | null;

  @Column({ type: TEXT, defaultValue: "" })
  soilWaterRestorationDescription: string;

  @Column({ type: TEXT, defaultValue: "" })
  waterStructures: string;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(TEXT)
  disturbanceDetails: string | null;

  @Column({ type: INTEGER, defaultValue: 0 })
  completion: number;

  @AllowNull
  @Column(DATE)
  approvedAt: Date | null;

  @AllowNull
  @Column(TEXT)
  sharedDriveLink: string | null;

  @AllowNull
  @Column(TEXT)
  oldModel: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number | null;

  @AllowNull
  @Column(TEXT("long"))
  answers: string | null;

  @AllowNull
  @Column(TEXT)
  polygonStatus: string | null;

  @AllowNull
  @Column(TEXT)
  paidOtherActivityDescription: string | null;

  @Column({ type: TEXT, defaultValue: "" })
  invasiveSpeciesRemoved: string;

  @Column({ type: TEXT, defaultValue: "" })
  invasiveSpeciesManagement: string;

  @Column({ type: TEXT, defaultValue: "" })
  siteCommunityPartnersDescription: string;

  @Column({ type: TEXT, defaultValue: "" })
  siteCommunityPartnersIncomeIncreaseDescription: string;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(BOOLEAN)
  nothingToReport: boolean | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: SiteReport.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted ?? [];
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: SiteReport.LARAVEL_TYPE, collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedable_type: SiteReport.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;
}
