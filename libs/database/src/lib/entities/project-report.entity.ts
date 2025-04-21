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
import { COMPLETE_REPORT_STATUSES, ReportStatus, ReportStatusStates, UpdateRequestStatus } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { Framework } from "./framework.entity";
import { SiteReport } from "./site-report.entity";
import { Literal } from "sequelize/types/utils";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { StateMachineColumn } from "../util/model-column-state-machine";

type ApprovedIdsSubqueryOptions = {
  dueAfter?: string | Date;
  dueBefore?: string | Date;
};

// Incomplete stub
@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  approved: { where: { status: { [Op.in]: ProjectReport.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } }),
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
    socioeconomicBenefits: { dbCollection: "socioeconomic_benefits", multiple: true },
    media: { dbCollection: "media", multiple: true },
    file: { dbCollection: "file", multiple: true },
    otherAdditionalDocuments: { dbCollection: "other_additional_documents", multiple: true },
    photos: { dbCollection: "photos", multiple: true }
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

  static siteReportIdsTaskSubquery(taskIds: number[], opts: ApprovedIdsSubqueryOptions = {}) {
    const builder = Subquery.select(SiteReport, "id").in("taskId", taskIds);
    if (opts.dueAfter != null) builder.gte("dueAt", opts.dueAfter);
    if (opts.dueBefore != null) builder.lt("dueAt", opts.dueBefore);
    return builder.literal;
  }

  static approvedSiteReportIdsTaskSubquery(taskIds: number[], opts: ApprovedIdsSubqueryOptions = {}) {
    const builder = Subquery.select(SiteReport, "id").in("taskId", taskIds).in("status", SiteReport.APPROVED_STATUSES);
    if (opts.dueAfter != null) builder.gte("dueAt", opts.dueAfter);
    if (opts.dueBefore != null) builder.lt("dueAt", opts.dueBefore);
    return builder.literal;
  }

  static siteReportsUnsubmittedIdsTaskSubquery(taskIds: number[] | Literal) {
    const builder = Subquery.select(SiteReport, "id")
      .in("taskId", taskIds)
      .in("status", SiteReport.UNSUBMITTED_STATUSES);
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
  taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  task: Task | null;

  @StateMachineColumn(ReportStatusStates)
  status: ReportStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @Column(TEXT)
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
