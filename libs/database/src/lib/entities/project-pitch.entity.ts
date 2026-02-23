import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
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
  DECIMAL,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  Op,
  STRING,
  TEXT,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { Organisation } from "./organisation.entity";
import { MediaConfiguration } from "../constants/media-owners";
import { FormSubmission } from "./form-submission.entity";
import { Subquery } from "../util/subquery.builder";
import { chainScope } from "../util/chain-scope";

type ProjectPitchMedia =
  | "cover"
  | "additional"
  | "restorationPhotos"
  | "detailedProjectBudget"
  | "proofOfLandTenureMou";

@Scopes(() => ({
  application: (applicationId: number) => ({
    where: { uuid: { [Op.in]: ProjectPitch.uuidForApplication(applicationId) } }
  })
}))
@Table({ tableName: "project_pitches", underscored: true, paranoid: true })
export class ProjectPitch extends Model<InferAttributes<ProjectPitch>, InferCreationAttributes<ProjectPitch>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\ProjectPitch";

  static readonly MEDIA: Record<ProjectPitchMedia, MediaConfiguration> = {
    cover: { dbCollection: "cover", multiple: false, validation: "cover-image" },
    additional: { dbCollection: "additional", multiple: true, validation: "general-documents" },
    restorationPhotos: { dbCollection: "restoration_photos", multiple: true, validation: "photos" },
    detailedProjectBudget: {
      dbCollection: "detailed_project_budget",
      multiple: false,
      validation: "spreadsheet"
    },
    proofOfLandTenureMou: { dbCollection: "proof_of_land_tenure_mou", multiple: true, validation: "general-documents" }
  };

  static application(applicationId: number) {
    return chainScope(this, "application", applicationId) as typeof ProjectPitch;
  }

  /**
   * A subquery to get the project pitch UUID associated with an application. Applications can have
   * multiple form submissions (one for each stage), but they're all associated with the same project
   * pitch.
   *
   * This would typically be used with the application scope and fineOne:
   * await ProjectPitch.application(applicationId).findOne();
   */
  static uuidForApplication(applicationId: number) {
    return Subquery.select(FormSubmission, "projectPitchUuid").eq("applicationId", applicationId).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @JsonColumn()
  capacityBuildingNeeds: string[] | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  totalTrees: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  totalHectares: number | null;

  @AllowNull
  @JsonColumn()
  restorationInterventionTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  restorationStrategy: string[] | null;

  @AllowNull
  @Column(STRING)
  projectCountyDistrict: string | null;

  @AllowNull
  @Column(STRING)
  projectCountry: string | null;

  @AllowNull
  @Column(TEXT("medium"))
  projectObjectives: string | null;

  @AllowNull
  @Column(STRING)
  projectName: string | null;

  @AllowNull
  @Column(UUID)
  organisationId: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationId", targetKey: "uuid", constraints: false })
  organisation: Organisation | null;

  @AllowNull
  @Column(UUID)
  fundingProgrammeId: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  projectBudget: number | null;

  @AllowNull
  @JsonColumn()
  howDiscovered: string[] | null;

  @Column({ type: STRING, defaultValue: "draft" })
  status: CreationOptional<string>;

  @AllowNull
  @Column(DATE)
  expectedActiveRestorationStartDate: Date | null;

  @AllowNull
  @Column(DATE)
  expectedActiveRestorationEndDate: Date | null;

  @AllowNull
  @Column(TEXT)
  descriptionOfProjectTimeline: string | null;

  @AllowNull
  @Column(TEXT)
  projPartnerInfo: string | null;

  @AllowNull
  @JsonColumn()
  landTenureProjArea: string[] | null;

  @AllowNull
  @Column(TEXT)
  landholderCommEngage: string | null;

  @AllowNull
  @Column(TEXT)
  projSuccessRisks: string | null;

  @AllowNull
  @Column(TEXT)
  monitorEvalPlan: string | null;

  @AllowNull
  @Column(TEXT)
  projBoundary: string | null;

  @AllowNull
  @JsonColumn()
  sustainableDevGoals: string[] | null;

  @AllowNull
  @Column(TEXT)
  projAreaDescription: string | null;

  @AllowNull
  @Column(TEXT)
  environmentalGoals: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  proposedNumSites: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  proposedNumNurseries: number | null;

  @AllowNull
  @Column(TEXT)
  currLandDegradation: string | null;

  @AllowNull
  @Column(TEXT)
  mainDegradationCauses: string | null;

  @AllowNull
  @Column(TEXT)
  seedlingsSource: string | null;

  @AllowNull
  @Column(TEXT)
  projImpactSocieconom: string | null;

  @AllowNull
  @Column(TEXT)
  projImpactFoodsec: string | null;

  @AllowNull
  @Column(TEXT)
  projImpactWatersec: string | null;

  @AllowNull
  @Column(TEXT)
  projImpactJobtypes: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  numJobsCreated: number | null;

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
  @Column(TEXT)
  mainCausesOfDegradation: string | null;

  @AllowNull
  @JsonColumn()
  states: string[] | null;

  @AllowNull
  @Column(INTEGER)
  hectaresFirstYr: number | null;

  @AllowNull
  @Column(INTEGER)
  totalTreesFirstYr: number | null;

  @AllowNull
  @Column(INTEGER)
  pctBeneficiariesBackwardClass: number | null;

  @AllowNull
  @JsonColumn()
  landSystems: string[] | null;

  @AllowNull
  @JsonColumn()
  treeRestorationPractices: string[] | null;

  @AllowNull
  @JsonColumn()
  detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  monitoringEvaluationPlan: string | null;

  @AllowNull
  @Column(INTEGER)
  pctBeneficiariesScheduledClasses: number | null;

  @AllowNull
  @Column(INTEGER)
  pctBeneficiariesScheduledTribes: number | null;

  @AllowNull
  @Column(TEXT)
  theoryOfChange: string | null;

  @AllowNull
  @Column(TEXT)
  proposedGovPartners: string | null;

  @AllowNull
  @Column(INTEGER)
  pctSchTribe: string | null;

  @AllowNull
  @Column(TEXT)
  sustainabilityPlan: string | null;

  @AllowNull
  @Column(TEXT)
  replicationPlan: string | null;

  @AllowNull
  @Column(TEXT)
  replicationChallenges: string | null;

  @AllowNull
  @Column(TEXT)
  solutionMarketSize: string | null;

  @AllowNull
  @Column(TEXT)
  affordabilityOfSolution: string | null;

  @AllowNull
  @Column(TEXT)
  growthTrendsBusiness: string | null;

  @AllowNull
  @Column(TEXT)
  limitationsOnScope: string | null;

  @AllowNull
  @Column(TEXT)
  businessModelReplicationPlan: string | null;

  @AllowNull
  @Column(TEXT)
  biodiversityImpact: string | null;

  @AllowNull
  @Column(TEXT)
  waterSource: string | null;

  @AllowNull
  @Column(TEXT)
  climateResilience: string | null;

  @AllowNull
  @Column(TEXT)
  soilHealth: string | null;

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
  @Column(INTEGER.UNSIGNED)
  directSeedingSurvivalRate: number | null;

  @AllowNull
  @JsonColumn({ field: "level_0_proposed" })
  level0Proposed: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_1_proposed" })
  level1Proposed: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_2_proposed" })
  level2Proposed: string[] | null;

  @AllowNull
  @Column(DECIMAL(15, 8))
  latProposed: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 8), field: "long_proposed" })
  lngProposed: number | null;

  @AllowNull
  @Column(TEXT)
  stakeholderEngagement: string | null;

  @AllowNull
  @Column(STRING)
  landownerAgreement: string | null;

  @AllowNull
  @Column(TEXT)
  landownerAgreementDescription: string | null;

  @AllowNull
  @Column(TEXT)
  landTenureDistribution: string | null;

  @AllowNull
  @Column(TEXT)
  landTenureRisks: string | null;

  @AllowNull
  @Column(TEXT)
  nonTreeInterventionsDescription: string | null;

  @AllowNull
  @Column(TEXT)
  complementExistingRestoration: string | null;

  @AllowNull
  @Column(TEXT)
  landUseTypeDistribution: string | null;

  @AllowNull
  @Column(TEXT)
  restorationStrategyDistribution: string | null;

  @AllowNull
  @Column(INTEGER)
  totalTreeSecondYr: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  projSurvivalRate: number | null;

  @AllowNull
  @Column(TEXT)
  anrApproach: string | null;

  @AllowNull
  @Column(TEXT)
  anrRights: string | null;

  @AllowNull
  @Column(TEXT)
  projectSiteModel: string | null;

  @AllowNull
  @Column(TEXT)
  indigenousImpact: string | null;

  @AllowNull
  @JsonColumn()
  barriersProjectActivity: string | null;

  @AllowNull
  @Column(TEXT)
  barriersProjectActivityDescription: string | null;

  @AllowNull
  @Column(TEXT)
  otherEngageWomenYouth: string | null;

  @AllowNull
  @Column(INTEGER)
  forestFragmentsDistance: number | null;

  @AllowNull
  @JsonColumn()
  anrPracticesProposed: string[] | null;

  @AllowNull
  @Column(BOOLEAN)
  informationAuthorization: boolean | null;

  @AllowNull
  @Column(TEXT)
  goalTreesRestoredDescription: string | null;

  @AllowNull
  @Column(TEXT)
  jobsCreatedBeneficiariesDescription: string | null;

  @AllowNull
  @Column(TEXT)
  consortium: string | null;
}
