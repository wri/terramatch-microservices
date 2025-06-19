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
import { BIGINT, BOOLEAN, DATE, INTEGER, Op, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Project } from "./project.entity";
import { FrameworkKey } from "../constants/framework";
import {
  AWAITING_APPROVAL,
  COMPLETE_REPORT_STATUSES,
  CompleteReportStatus,
  DUE,
  ReportStatus,
  ReportStatusStates,
  UpdateRequestStatus
} from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { Framework } from "./framework.entity";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { getStateMachine, StateMachineColumn } from "../util/model-column-state-machine";
import { JsonColumn } from "../decorators/json-column.decorator";

type ApprovedIdsSubqueryOptions = {
  dueAfter?: string | Date;
  dueBefore?: string | Date;
};

// Incomplete stub
@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  approved: { where: { status: { [Op.in]: ProjectReport.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } }),
  projectsIds: (ids: number[]) => ({ where: { projectId: { [Op.in]: ids } } }),
  dueBefore: (date: Date | string) => ({ where: { dueAt: { [Op.lt]: date } } }),
  task: (taskId: number) => ({ where: { taskId } })
}))
@Table({ tableName: "v2_project_reports", underscored: true, paranoid: true })
export class ProjectReport extends Model<ProjectReport> {
  static readonly TREE_ASSOCIATIONS = ["nurserySeedlings"];
  static readonly PARENT_ID = "projectId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\ProjectReport";

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
    baselineReportUpload: { dbCollection: "baseline_report_upload", multiple: true, validation: "general-documents" },
    localGovernanceOrderLetterUpload: {
      dbCollection: "local_governance_order_letter_upload",
      multiple: true,
      validation: "general-documents"
    },
    eventsMeetingsPhotos: { dbCollection: "events_meetings_photos", multiple: true, validation: "photos" },
    localGovernanceProofOfPartnershipUpload: {
      dbCollection: "local_governance_proof_of_partnership_upload",
      multiple: true,
      validation: "general-documents"
    },
    topThreeSuccessesUpload: {
      dbCollection: "top_three_successes_upload",
      multiple: true,
      validation: "general-documents"
    },
    directJobsUpload: { dbCollection: "direct_jobs_upload", multiple: true, validation: "general-documents" },
    convergenceJobsUpload: { dbCollection: "convergence_jobs_upload", multiple: true, validation: "general-documents" },
    convergenceSchemesUpload: {
      dbCollection: "convergence_schemes_upload",
      multiple: true,
      validation: "general-documents"
    },
    livelihoodActivitiesUpload: {
      dbCollection: "livelihood_activities_upload",
      multiple: true,
      validation: "general-documents"
    },
    directLivelihoodImpactsUpload: {
      dbCollection: "direct_livelihood_impacts_upload",
      multiple: true,
      validation: "general-documents"
    },
    certifiedDatabaseUpload: {
      dbCollection: "certified_database_upload",
      multiple: true,
      validation: "general-documents"
    },
    physicalAssetsPhotos: { dbCollection: "physical_assets_photos", multiple: true, validation: "photos" },
    indirectCommunityPartnersUpload: {
      dbCollection: "indirect_community_partners_upload",
      multiple: true,
      validation: "general-documents"
    },
    trainingCapacityBuildingUpload: {
      dbCollection: "training_capacity_building_upload",
      multiple: true,
      validation: "general-documents"
    },
    trainingCapacityBuildingPhotos: {
      dbCollection: "training_capacity_building_photos",
      multiple: true,
      validation: "photos"
    },
    financialReportUpload: { dbCollection: "financial_report_upload", multiple: true, validation: "general-documents" }
  } as const;

  static incomplete() {
    return chainScope(this, "incomplete") as typeof ProjectReport;
  }

  static approved() {
    return chainScope(this, "approved") as typeof ProjectReport;
  }

  static project(id: number) {
    return chainScope(this, "project", id) as typeof ProjectReport;
  }

  static projectsIds(ids: number[]) {
    return chainScope(this, "projectsIds", ids) as typeof ProjectReport;
  }

  static dueBefore(date: Date | string) {
    return chainScope(this, "dueBefore", date) as typeof ProjectReport;
  }

  static approvedIdsSubquery(projectId: number, opts: ApprovedIdsSubqueryOptions = {}) {
    const builder = Subquery.select(ProjectReport, "id")
      .eq("projectId", projectId)
      .in("status", ProjectReport.APPROVED_STATUSES);
    if (opts.dueAfter != null) builder.gte("dueAt", opts.dueAfter);
    if (opts.dueBefore != null) builder.lt("dueAt", opts.dueBefore);
    return builder.literal;
  }

  static approvedProjectsIdsSubquery(projectIds: number[]) {
    const builder = Subquery.select(ProjectReport, "id")
      .in("projectId", projectIds)
      .in("status", ProjectReport.APPROVED_STATUSES);
    return builder.literal;
  }

  static task(taskId: number) {
    return chainScope(this, "task", taskId) as typeof ProjectReport;
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

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  framework: Framework | null;

  get frameworkUuid() {
    return this.framework?.uuid;
  }

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  createdByUser: User | null;

  get createdByFirstName() {
    return this.createdByUser?.firstName;
  }

  get createdByLastName() {
    return this.createdByUser?.lastName;
  }

  @BelongsTo(() => Project)
  project: Project | null;

  @BelongsTo(() => User)
  user: User | null;

  get projectName() {
    return this.project?.name;
  }

  get projectUuid() {
    return this.project?.uuid;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  get organisationUuid() {
    return this.project?.organisation?.uuid;
  }

  get taskUuid() {
    return this.task?.uuid;
  }

  @AllowNull
  @Column(STRING)
  title: string | null;

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number | null;

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
    if (this.isComplete) return true;
    if (this.status === DUE) return false;
    return getStateMachine(this, "status")?.canBe(this.status, AWAITING_APPROVAL);
  }

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(INTEGER)
  completion: number | null;

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
  @Column(TEXT)
  landscapeCommunityContribution: string | null;

  @AllowNull
  @Column(TEXT)
  topThreeSuccesses: string | null;

  @AllowNull
  @Column(TEXT)
  challengesFaced: string | null;

  @AllowNull
  @Column(TEXT)
  lessonsLearned: string | null;

  @AllowNull
  @Column(TEXT)
  maintenanceAndMonitoringActivities: string | null;

  @AllowNull
  @Column(TEXT)
  significantChange: string | null;

  @AllowNull
  @Column(TINYINT.UNSIGNED)
  pctSurvivalToDate: number | null;

  @AllowNull
  @Column(TEXT)
  survivalCalculation: string | null;

  @AllowNull
  @Column(TEXT)
  survivalComparison: string | null;

  @AllowNull
  @Column(TEXT)
  newJobsDescription: string | null;

  @AllowNull
  @Column(TEXT)
  volunteersWorkDescription: string | null;

  @AllowNull
  @Column(TEXT)
  beneficiariesDescription: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesIncomeIncrease: number | null;

  @AllowNull
  @Column(TEXT)
  beneficiariesIncomeIncreaseDescription: string | null;

  @AllowNull
  @Column(TEXT)
  beneficiariesSkillsKnowledgeIncreaseDescription: string | null;

  @AllowNull
  @Column(INTEGER)
  indirectBeneficiaries: number | null;

  @AllowNull
  @Column(TEXT)
  indirectBeneficiariesDescription: string | null;

  @AllowNull
  @Column(TEXT)
  sharedDriveLink: string | null;

  @AllowNull
  @Column(TEXT)
  communityProgress: string | null;

  @AllowNull
  @Column(TEXT)
  localEngagementDescription: string | null;

  @AllowNull
  @Column(TEXT)
  localEngagement: string | null;

  @AllowNull
  @Column(TEXT)
  equitableOpportunities: string | null;

  @AllowNull
  @Column(TEXT)
  resilienceProgress: string | null;

  @AllowNull
  @Column(TEXT)
  localGovernance: string | null;

  @AllowNull
  @Column(TEXT)
  adaptiveManagement: string | null;

  @AllowNull
  @Column(TEXT)
  scalabilityReplicability: string | null;

  @AllowNull
  @Column(TEXT)
  convergenceJobsDescription: string | null;

  @AllowNull
  @Column(TEXT)
  convergenceSchemes: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  convergenceAmount: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesScstobc: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesScstobcFarmers: number | null;

  @AllowNull
  @Column(TEXT)
  communityPartnersAssetsDescription: string | null;

  @AllowNull
  @Column(INTEGER)
  peopleKnowledgeSkillsIncreased: number | null;

  @AllowNull
  @Column(TEXT)
  technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  publicNarrative: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  totalUniqueRestorationPartners: number | null;

  @AllowNull
  @Column(TEXT)
  businessMilestones: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seasonalMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seasonalWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seasonalYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seasonalSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seasonalTotal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  plantedTrees: number | null;

  @AllowNull
  @Column(STRING)
  oldModel: string;

  @AllowNull
  @Column(BOOLEAN)
  siteAddition: boolean;

  @AllowNull
  @Column(TEXT)
  paidOtherActivityDescription: string | null;

  @AllowNull
  @Column(TEXT("long"))
  answers: string | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: ProjectReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  nurserySeedlings: TreeSpecies[] | null;
}
