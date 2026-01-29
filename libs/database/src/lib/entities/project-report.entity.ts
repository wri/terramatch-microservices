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
import { FrameworkKey, PlantingStatus } from "../constants";
import {
  AWAITING_APPROVAL,
  COMPLETE_REPORT_STATUSES,
  CompleteReportStatus,
  DUE,
  ReportStatus,
  ReportStatusStates,
  statusUpdateSequelizeHook,
  UpdateRequestStatus
} from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { Framework } from "./framework.entity";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { getStateMachine, StateMachineColumn } from "../util/model-column-state-machine";
import { JsonColumn } from "../decorators/json-column.decorator";
import { MediaConfiguration } from "../constants/media-owners";
import { Dictionary } from "lodash";

type ApprovedIdsSubqueryOptions = {
  dueAfter?: string | Date;
  dueBefore?: string | Date;
};

type ProjectReportMedia =
  | "socioeconomicBenefits"
  | "media"
  | "file"
  | "otherAdditionalDocuments"
  | "photos"
  | "baselineReportUpload"
  | "localGovernanceOrderLetterUpload"
  | "eventsMeetingsPhotos"
  | "localGovernanceProofOfPartnershipUpload"
  | "topThreeSuccessesUpload"
  | "directJobsUpload"
  | "convergenceJobsUpload"
  | "convergenceSchemesUpload"
  | "livelihoodActivitiesUpload"
  | "directLivelihoodImpactsUpload"
  | "certifiedDatabaseUpload"
  | "physicalAssetsPhotos"
  | "indirectCommunityPartnersUpload"
  | "trainingCapacityBuildingUpload"
  | "trainingCapacityBuildingPhotos"
  | "financialReportUpload"
  | "treePlantingUpload"
  | "soilWaterConservationUpload"
  | "soilWaterConservationPhotos";

@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  approved: { where: { status: { [Op.in]: ProjectReport.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } }),
  projectsIds: (ids: number[]) => ({ where: { projectId: { [Op.in]: ids } } }),
  dueBefore: (date: Date | string) => ({ where: { dueAt: { [Op.lt]: date } } }),
  task: (taskId: number) => ({ where: { taskId } }),
  lastReport: { order: [["dueAt", "DESC"]], limit: 1 }
}))
@Table({
  tableName: "v2_project_reports",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class ProjectReport extends Model<ProjectReport> {
  static readonly TREE_ASSOCIATIONS = ["nurserySeedlings"];
  static readonly PARENT_ID = "projectId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\ProjectReport";

  static readonly MEDIA: Record<ProjectReportMedia, MediaConfiguration> = {
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
    financialReportUpload: { dbCollection: "financial_report_upload", multiple: true, validation: "general-documents" },
    treePlantingUpload: { dbCollection: "tree_planting_upload", multiple: true, validation: "general-documents" },
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
  };

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

  static lastReport() {
    return chainScope(this, "lastReport") as typeof ProjectReport;
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

  static idsSubquery(projectId: number) {
    return Subquery.select(ProjectReport, "id").eq("projectId", projectId).literal;
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

  get frameworkUuid(): string | undefined {
    return this.framework?.uuid;
  }

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  createdByUser: User | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  approvedBy: number;

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

  get projectUuid(): string | undefined {
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
  @Column(INTEGER.UNSIGNED)
  newJobsCreated: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  newVolunteers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftJobsNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftJobsYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerNonYouth: number | null;

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
  @Column(INTEGER.UNSIGNED)
  beneficiariesTrainingWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesTrainingMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesTrainingOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesTrainingYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesTrainingNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiaries: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesSmallholder: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesLargeScale: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesSkillsKnowledgeIncrease: number | null;

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

  @Column({ type: TEXT, defaultValue: "" })
  resilienceProgress: string;

  @Column({ type: TEXT, defaultValue: "" })
  localGovernance: string;

  @Column({ type: TEXT, defaultValue: "" })
  adaptiveManagement: string;

  @Column({ type: TEXT, defaultValue: "" })
  scalabilityReplicability: string;

  @Column({ type: TEXT, defaultValue: "" })
  convergenceJobsDescription: string;

  @Column({ type: TEXT, defaultValue: "" })
  convergenceSchemes: string;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  convergenceAmount: number;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  volunteerScstobc: number;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  beneficiariesScstobc: number;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  beneficiariesScstobcFarmers: number;

  @Column({ type: TEXT, defaultValue: "" })
  communityPartnersAssetsDescription: string;

  @AllowNull
  @Column(INTEGER)
  peopleKnowledgeSkillsIncreased: number | null;

  @AllowNull
  @Column(TEXT)
  technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  publicNarrative: string | null;

  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  totalUniqueRestorationPartners: number;

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
  volunteerOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  volunteerTotal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  plantedTrees: number | null;

  @AllowNull
  @Column(STRING)
  oldModel: string;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number | null;

  @AllowNull
  @Column(BOOLEAN)
  siteAddition: boolean;

  @Column({ type: TEXT, defaultValue: "" })
  paidOtherActivityDescription: string;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(STRING)
  plantingStatus: PlantingStatus | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ftTotal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ptTotal: number | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: ProjectReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  nurserySeedlings: TreeSpecies[] | null;

  static projectUuidsForLatestApprovedPlantingStatus(plantingStatus: PlantingStatus) {
    if (ProjectReport.sequelize == null) {
      throw new Error("Sequelize instance not available");
    }
    const sql = ProjectReport.sequelize;
    return sql.literal(
      `(
        SELECT p.uuid
        FROM v2_projects p
        WHERE p.deleted_at IS NULL
          AND (
            SELECT pr.planting_status
            FROM v2_project_reports pr
            WHERE pr.project_id = p.id
              AND pr.deleted_at IS NULL
              AND pr.status = 'approved'
            ORDER BY pr.due_at DESC
            LIMIT 1
          ) = ${sql.escape(plantingStatus)}
      )`
    );
  }
}
