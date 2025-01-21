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
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, INTEGER, STRING, TEXT, TINYINT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Project } from "./project.entity";

// Incomplete stub
@Table({ tableName: "v2_project_reports", underscored: true, paranoid: true })
export class ProjectReport extends Model<ProjectReport> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted"];
  static readonly PARENT_ID = "projectId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\ProjectReport";
  static readonly WORKDAY_COLLECTIONS = [
    "paid-nursery-operations",
    "paid-project-management",
    "paid-other-activities",
    "volunteer-nursery-operations",
    "volunteer-project-management",
    "volunteer-other-activities",
    "direct",
    "convergence"
  ];
  static readonly RESTORATION_PARTNER_COLLECTIONS = [
    "direct-income",
    "indirect-income",
    "direct-benefits",
    "indirect-benefits",
    "direct-conservation-payments",
    "indirect-conservation-payments",
    "direct-market-access",
    "indirect-market-access",
    "direct-capacity",
    "indirect-capacity",
    "direct-training",
    "indirect-training",
    "direct-land-title",
    "indirect-land-title",
    "direct-livelihoods",
    "indirect-livelihoods",
    "direct-productivity",
    "indirect-productivity",
    "direct-other",
    "indirect-other"
  ];

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  @Column(STRING)
  status: string;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: string;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

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
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftTotal: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftOther: number | null;

  @AllowNull
  // There is also an `ft_jobs_youth` field, but it appears to be unused.
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ftYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ unsigned: true, length: 10 }), field: "ft_jobs_non_youth" })
  ftNonYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptTotal: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptNonYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  ptOther: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerTotal: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerNonYouth: number | null;

  @AllowNull
  @Column(TEXT)
  volunteersWorkDescription: string | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  volunteerOther: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiaries: number | null;

  @AllowNull
  @Column(TEXT)
  beneficiariesDescription: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesWomen: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesLargeScale: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesSmallholder: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  beneficiariesOther: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  beneficiariesTrainingWomen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  beneficiariesTrainingMen: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  beneficiariesTrainingOther: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  beneficiariesTrainingYouth: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  beneficiariesTrainingNonYouth: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  beneficiariesIncomeIncrease: number | null;

  @AllowNull
  @Column(TEXT)
  beneficiariesIncomeIncreaseDescription: string | null;

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
  equitableOpportunities: string | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: ProjectReport.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;
}
