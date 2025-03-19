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
import { TreeSpecies } from "./tree-species.entity";
import { Project } from "./project.entity";
import { FrameworkKey } from "../constants/framework";
import { COMPLETE_REPORT_STATUSES } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";

type ApprovedIdsSubqueryOptions = {
  dueAfter?: string | Date;
  dueBefore?: string | Date;
};

// Incomplete stub
@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  approved: { where: { status: { [Op.in]: ProjectReport.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } }),
  dueBefore: (date: Date | string) => ({ where: { dueAt: { [Op.lt]: date } } })
}))
@Table({ tableName: "v2_project_reports", underscored: true, paranoid: true })
export class ProjectReport extends Model<ProjectReport> {
  static readonly TREE_ASSOCIATIONS = ["nurserySeedlings"];
  static readonly PARENT_ID = "projectId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\ProjectReport";

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

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  // TODO foreign key for task
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number;

  @Column(STRING)
  status: string;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: string;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

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

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: ProjectReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  nurserySeedlings: TreeSpecies[] | null;
}
