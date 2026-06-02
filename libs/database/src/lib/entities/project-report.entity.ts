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
import { removeMedia } from "../hooks/remove-media";
import { removeActions } from "../hooks/remove-actions";
import { Literal } from "sequelize/lib/utils";

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
  | "managementAccountsUpload"
  | "treePlantingUpload"
  | "soilWaterConservationUpload"
  | "soilWaterConservationPhotos";

@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  approved: { where: { status: { [Op.in]: ProjectReport.APPROVED_STATUSES } } },
  pctSurvivalToDate: { where: { pctSurvivalToDate: { [Op.ne]: null } } },
  /** Approved reports with pctSurvivalToDate > 0 only (avoids showing 0 when meaning "no data"). */
  pctSurvivalToDatePositive: { where: { pctSurvivalToDate: { [Op.gt]: 0 } } },
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
  hooks: {
    afterCreate: statusUpdateSequelizeHook,
    afterDestroy: async (report: ProjectReport) => {
      await removeMedia(report);
      await removeActions(report);
    }
  }
})
export class ProjectReport extends Model<ProjectReport> {
  static readonly TREE_ASSOCIATIONS = ["nurserySeedlings"];
  static readonly PARENT_ID = "projectId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\ProjectReport";

  static get sql() {
    if (ProjectReport.sequelize == null) {
      throw new Error("Sequelize instance not available");
    }
    return ProjectReport.sequelize;
  }

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
    managementAccountsUpload: {
      dbCollection: "management_accounts_upload",
      multiple: true,
      validation: "general-documents"
    },
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

  static pctSurvivalToDate() {
    return chainScope(this, "pctSurvivalToDate") as typeof ProjectReport;
  }

  static pctSurvivalToDatePositive() {
    return chainScope(this, "pctSurvivalToDatePositive") as typeof ProjectReport;
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

  static uuidsSubquery(projectIds: number[] | Literal) {
    return Subquery.select(ProjectReport, "uuid").in("projectId", projectIds).literal;
  }

  static task(taskId: number) {
    return chainScope(this, "task", taskId) as typeof ProjectReport;
  }

  static projectUuidsForLatestApprovedPlantingStatus(plantingStatus: PlantingStatus) {
    return ProjectReport.sql.literal(
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
          ) = ${ProjectReport.sql.escape(plantingStatus)}
      )`
    );
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  get frameworkUuid(): string | undefined {
    return this.framework?.uuid;
  }

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  @BelongsTo(() => User, { foreignKey: "createdBy", as: "createdByUser" })
  declare createdByUser: User | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare approvedBy: number;

  get createdByFirstName() {
    return this.createdByUser?.firstName;
  }

  get createdByLastName() {
    return this.createdByUser?.lastName;
  }

  @BelongsTo(() => Project)
  declare project: Project | null;

  @BelongsTo(() => User)
  declare user: User | null;

  get projectName() {
    return this.project?.name;
  }

  get projectUuid(): string | undefined {
    return this.project?.uuid;
  }

  get projectExportId(): number | undefined {
    return this.project?.exportId;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  get organisationUuid() {
    return this.project?.organisationUuid as string | undefined;
  }

  get organisationReadableType() {
    return this.project?.organisationReadableType as string | undefined;
  }

  get taskUuid() {
    return this.task?.uuid;
  }

  @AllowNull
  @Column(STRING)
  declare title: string | null;

  @ForeignKey(() => Task)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare taskId: number | null;

  @BelongsTo(() => Task, { constraints: false })
  declare task: Task | null;

  @StateMachineColumn(ReportStatusStates)
  declare status: ReportStatus;

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
  declare updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(TEXT)
  declare feedback: string | null;

  @AllowNull
  @JsonColumn()
  declare feedbackFields: string[] | null;

  @AllowNull
  @Column(INTEGER)
  declare completion: number | null;

  @AllowNull
  @Column(DATE)
  declare dueAt: Date | null;

  @AllowNull
  @Column(DATE)
  declare submittedAt: Date | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  declare workdaysPaid: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  declare workdaysVolunteer: number | null;

  @AllowNull
  @Column(TEXT)
  declare landscapeCommunityContribution: string | null;

  @AllowNull
  @Column(TEXT)
  declare topThreeSuccesses: string | null;

  @AllowNull
  @Column(TEXT)
  declare challengesFaced: string | null;

  @AllowNull
  @Column(TEXT)
  declare lessonsLearned: string | null;

  @AllowNull
  @Column(TEXT)
  declare maintenanceAndMonitoringActivities: string | null;

  @AllowNull
  @Column(TEXT)
  declare significantChange: string | null;

  @AllowNull
  @Column(TINYINT.UNSIGNED)
  declare pctSurvivalToDate: number | null;

  @AllowNull
  @Column(TEXT)
  declare survivalCalculation: string | null;

  @AllowNull
  @Column(TEXT)
  declare survivalComparison: string | null;

  @AllowNull
  @Column(TEXT)
  declare newJobsDescription: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare newJobsCreated: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare newVolunteers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftJobsNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftJobsYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerNonYouth: number | null;

  @AllowNull
  @Column(TEXT)
  declare volunteersWorkDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare beneficiariesDescription: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesIncomeIncrease: number | null;

  @AllowNull
  @Column(TEXT)
  declare beneficiariesIncomeIncreaseDescription: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesTrainingWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesTrainingMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesTrainingOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesTrainingYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesTrainingNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiaries: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesSmallholder: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesLargeScale: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare beneficiariesSkillsKnowledgeIncrease: number | null;

  @AllowNull
  @Column(TEXT)
  declare beneficiariesSkillsKnowledgeIncreaseDescription: string | null;

  @AllowNull
  @Column(INTEGER)
  declare indirectBeneficiaries: number | null;

  @AllowNull
  @Column(TEXT)
  declare indirectBeneficiariesDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare sharedDriveLink: string | null;

  @AllowNull
  @Column(TEXT)
  declare communityProgress: string | null;

  @AllowNull
  @Column(TEXT)
  declare localEngagementDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare localEngagement: string | null;

  @AllowNull
  @Column(TEXT)
  declare equitableOpportunities: string | null;

  @AllowNull
  @Column({ type: TEXT })
  declare resilienceProgress: string | null;

  @AllowNull
  @Column({ type: TEXT })
  declare localGovernance: string | null;

  @AllowNull
  @Column({ type: TEXT })
  declare adaptiveManagement: string | null;

  @AllowNull
  @Column({ type: TEXT })
  declare scalabilityReplicability: string | null;

  @AllowNull
  @Column({ type: TEXT })
  declare convergenceJobsDescription: string | null;

  @AllowNull
  @Column({ type: TEXT })
  declare convergenceSchemes: string | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED })
  declare convergenceAmount: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED })
  declare volunteerScstobc: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED })
  declare beneficiariesScstobc: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED })
  declare beneficiariesScstobcFarmers: number | null;

  @AllowNull
  @Column({ type: TEXT })
  declare communityPartnersAssetsDescription: string | null;

  @AllowNull
  @Column(INTEGER)
  declare peopleKnowledgeSkillsIncreased: number | null;

  @AllowNull
  @Column(TEXT)
  declare technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  declare publicNarrative: string | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED })
  declare totalUniqueRestorationPartners: number | null;

  @AllowNull
  @Column(TEXT)
  declare businessMilestones: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seasonalMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seasonalWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seasonalYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seasonalSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seasonalTotal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerSmallholderFarmers: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare volunteerTotal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare plantedTrees: number | null;

  @AllowNull
  @Column(STRING)
  declare oldModel: string;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare oldId: number | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare siteAddition: boolean;

  @Column({ type: TEXT, defaultValue: "" })
  declare paidOtherActivityDescription: string;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  declare answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(STRING)
  declare plantingStatus: PlantingStatus | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ftTotal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptMen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ptTotal: number | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: ProjectReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  declare nurserySeedlings: TreeSpecies[] | null;

  @AllowNull
  @Column(TEXT)
  declare elpDescription: string | null;
}
