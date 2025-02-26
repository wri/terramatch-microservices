import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Default,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, DECIMAL, ENUM, INTEGER, STRING, TEXT, TINYINT, UUID } from "sequelize";
import { Organisation } from "./organisation.entity";
import { TreeSpecies } from "./tree-species.entity";
import { ProjectReport } from "./project-report.entity";
import { Application } from "./application.entity";
import { Site } from "./site.entity";
import { Nursery } from "./nursery.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { FrameworkKey } from "../constants/framework";
import { Framework } from "./framework.entity";
import { EntityStatus, UpdateRequestStatus } from "../constants/status";

@Table({ tableName: "v2_projects", underscored: true, paranoid: true })
export class Project extends Model<Project> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\Project";

  static readonly MEDIA = {
    media: { dbCollection: "media", multiple: true },
    socioeconomicBenefits: { dbCollection: "socioeconomic_benefits", multiple: true },
    file: { dbCollection: "file", multiple: true },
    otherAdditionalDocuments: { dbCollection: "other_additional_documents", multiple: true },
    photos: { dbCollection: "photos", multiple: true },
    documentFiles: { dbCollection: "document_files", multiple: true },
    programmeSubmission: { dbCollection: "programme_submission", multiple: true },
    detailedProjectBudget: { dbCollection: "detailed_project_budget", multiple: false },
    proofOfLandTenureMou: { dbCollection: "proof_of_land_tenure_mou", multiple: true }
  } as const;

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

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  framework: Framework | null;

  get frameworkUuid() {
    return this.framework?.uuid;
  }

  @AllowNull
  @Column(STRING)
  cohort: string;

  @Default(false)
  @Column(BOOLEAN)
  isTest: boolean;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number | null;

  @AllowNull
  @ForeignKey(() => Application)
  @Column(BIGINT.UNSIGNED)
  applicationId: number | null;

  @AllowNull
  @Column(STRING)
  status: EntityStatus | null;

  @AllowNull
  @Default("no-update")
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(ENUM("new_project", "existing_expansion"))
  projectStatus: string | null;

  @AllowNull
  @Column(TEXT("long"))
  boundaryGeojson: string | null;

  @AllowNull
  @JsonColumn()
  landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  restorationStrategy: string[] | null;

  @AllowNull
  @Column(TEXT)
  country: string | null;

  @AllowNull
  @Column(TEXT)
  continent: string | null;

  @AllowNull
  @Column(DATE)
  plantingStartDate: Date | null;

  @AllowNull
  @Column(DATE)
  plantingEndDate: Date | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(TEXT)
  history: string | null;

  @AllowNull
  @Column(TEXT)
  objectives: string | null;

  @AllowNull
  @Column(TEXT)
  environmentalGoals: string | null;

  @AllowNull
  @Column(TEXT)
  socioeconomicGoals: string | null;

  @AllowNull
  @Column(TEXT)
  sdgsImpacted: string | null;

  @AllowNull
  @Column(TEXT)
  longTermGrowth: string | null;

  @AllowNull
  @Column(TEXT)
  communityIncentives: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  budget: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  jobsCreatedGoal: number | null;

  @AllowNull
  @Column(DECIMAL(15, 1))
  totalHectaresRestoredGoal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  treesGrownGoal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  survivalRate: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  yearFiveCrownCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  monitoredTreeCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ppcExternalId: number | null;

  @AllowNull
  @Column(TEXT("long"))
  answers: string | null;

  @AllowNull
  @Column(TEXT)
  organizationName: string | null;

  @AllowNull
  @Column(TEXT)
  projectCountyDistrict: string | null;

  @AllowNull
  @Column(TEXT)
  descriptionOfProjectTimeline: string | null;

  @AllowNull
  @Column(TEXT)
  sitingStrategyDescription: string | null;

  @AllowNull
  @Column(TEXT)
  sitingStrategy: string | null;

  @AllowNull
  @JsonColumn()
  landTenureProjectArea: string[] | null;

  @AllowNull
  @Column(TEXT)
  landholderCommEngage: string | null;

  @AllowNull
  @Column(TEXT)
  projPartnerInfo: string | null;

  @AllowNull
  @Column(TEXT)
  projSuccessRisks: string | null;

  @AllowNull
  @Column(TEXT)
  monitorEvalPlan: string | null;

  @AllowNull
  @Column(TEXT)
  seedlingsSource: string | null;

  @AllowNull
  @Column(TINYINT)
  pctEmployeesMen: number | null;

  @AllowNull
  @Column(TINYINT)
  pctEmployeesWomen: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_18to35" })
  pctEmployees18To35: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_older35" })
  pctEmployeesOlder35: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  projBeneficiaries: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesWomen: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesSmall: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesLarge: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesYouth: number | null;

  @AllowNull
  @JsonColumn()
  detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  projImpactFoodsec: string | null;

  @AllowNull
  @Column(TINYINT)
  pctEmployeesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesMen: number | null;

  @AllowNull
  @Column(TEXT)
  proposedGovPartners: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  proposedNumNurseries: number | null;

  @AllowNull
  @Column(TEXT)
  projBoundary: string | null;

  @AllowNull
  @JsonColumn()
  states: string[] | null;

  @AllowNull
  @Column(TEXT)
  projImpactBiodiv: string | null;

  @AllowNull
  @Column(TEXT)
  waterSource: string | null;

  @AllowNull
  @Column(TEXT)
  baselineBiodiversity: string | null;

  @AllowNull
  @Column(INTEGER)
  goalTreesRestoredPlanting: number | null;

  @AllowNull
  @Column(INTEGER)
  goalTreesRestoredAnr: number | null;

  @AllowNull
  @Column(INTEGER)
  goalTreesRestoredDirectSeeding: number | null;

  @AllowNull
  @Column(DECIMAL(10, 8))
  lat: number | null;

  @AllowNull
  @Column(DECIMAL(11, 8))
  long: number | null;

  @AllowNull
  @Column(STRING)
  landscape: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  directSeedingSurvivalRate: number | null;

  @BelongsTo(() => Organisation)
  organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name;
  }

  @BelongsTo(() => Application)
  application: Application | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Project.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  @HasMany(() => ProjectReport)
  reports: ProjectReport[] | null;

  @HasMany(() => Site)
  sites: Site[] | null;

  @HasMany(() => Nursery)
  nurseries: Nursery[] | null;
}
