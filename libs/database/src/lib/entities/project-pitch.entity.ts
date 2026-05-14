import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  HasOne,
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
import { removeMedia } from "../hooks/remove-media";

type ProjectPitchMedia =
  | "cover"
  | "additional"
  | "restorationPhotos"
  | "detailedProjectBudget"
  | "proofOfLandTenureMou"
  | "consortiumPartnershipAgreements";

@Scopes(() => ({
  application: (applicationId: number) => ({
    where: { uuid: { [Op.in]: ProjectPitch.uuidForApplication(applicationId) } }
  })
}))
@Table({ tableName: "project_pitches", underscored: true, paranoid: true, hooks: { afterDestroy: removeMedia } })
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
    proofOfLandTenureMou: { dbCollection: "proof_of_land_tenure_mou", multiple: true, validation: "general-documents" },
    consortiumPartnershipAgreements: {
      dbCollection: "consortium_partnership_agreements",
      multiple: true,
      validation: "general-documents"
    }
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
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @HasOne(() => FormSubmission, { foreignKey: "projectPitchUuid", sourceKey: "uuid", constraints: false })
  declare formSubmission: FormSubmission | null;

  @AllowNull
  @JsonColumn()
  declare capacityBuildingNeeds: string[] | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare totalTrees: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare totalHectares: number | null;

  @AllowNull
  @JsonColumn()
  declare restorationInterventionTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  declare landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  declare restorationStrategy: string[] | null;

  @AllowNull
  @Column(STRING)
  declare projectCountyDistrict: string | null;

  @AllowNull
  @Column(STRING)
  declare projectCountry: string | null;

  @AllowNull
  @Column(TEXT("medium"))
  declare projectObjectives: string | null;

  @AllowNull
  @Column(STRING)
  declare projectName: string | null;

  @AllowNull
  @Column(UUID)
  declare organisationId: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationId", targetKey: "uuid", constraints: false })
  declare organisation: Organisation | null;

  @AllowNull
  @Column(UUID)
  declare fundingProgrammeId: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare projectBudget: number | null;

  @AllowNull
  @JsonColumn()
  declare howDiscovered: string[] | null;

  @Column({ type: STRING, defaultValue: "draft" })
  declare status: CreationOptional<string>;

  @AllowNull
  @Column(DATE)
  declare expectedActiveRestorationStartDate: Date | null;

  @AllowNull
  @Column(DATE)
  declare expectedActiveRestorationEndDate: Date | null;

  @AllowNull
  @Column(TEXT)
  declare descriptionOfProjectTimeline: string | null;

  @AllowNull
  @Column(TEXT)
  declare projPartnerInfo: string | null;

  @AllowNull
  @JsonColumn()
  declare landTenureProjArea: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare landholderCommEngage: string | null;

  @AllowNull
  @Column(TEXT)
  declare projSuccessRisks: string | null;

  @AllowNull
  @Column(TEXT)
  declare monitorEvalPlan: string | null;

  @AllowNull
  @Column(TEXT)
  declare projBoundary: string | null;

  @AllowNull
  @JsonColumn()
  declare sustainableDevGoals: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare projAreaDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare environmentalGoals: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare proposedNumSites: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare proposedNumNurseries: number | null;

  @AllowNull
  @Column(TEXT)
  declare currLandDegradation: string | null;

  @AllowNull
  @Column(TEXT)
  declare mainDegradationCauses: string | null;

  @AllowNull
  @Column(TEXT)
  declare seedlingsSource: string | null;

  @AllowNull
  @Column(TEXT)
  declare projImpactSocieconom: string | null;

  @AllowNull
  @Column(TEXT)
  declare projImpactFoodsec: string | null;

  @AllowNull
  @Column(TEXT)
  declare projImpactWatersec: string | null;

  @AllowNull
  @Column(TEXT)
  declare projImpactJobtypes: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare numJobsCreated: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctEmployeesMen: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctEmployeesWomen: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_18to35" })
  declare pctEmployees18To35: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_older35" })
  declare pctEmployeesOlder35: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare projBeneficiaries: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesWomen: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesSmall: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesLarge: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesYouth: number | null;

  @AllowNull
  @Column(TEXT)
  declare mainCausesOfDegradation: string | null;

  @AllowNull
  @JsonColumn()
  declare states: string[] | null;

  @AllowNull
  @Column(INTEGER)
  declare hectaresFirstYr: number | null;

  @AllowNull
  @Column(INTEGER)
  declare totalTreesFirstYr: number | null;

  @AllowNull
  @Column(INTEGER)
  declare pctBeneficiariesBackwardClass: number | null;

  @AllowNull
  @JsonColumn()
  declare landSystems: string[] | null;

  @AllowNull
  @JsonColumn()
  declare treeRestorationPractices: string[] | null;

  @AllowNull
  @JsonColumn()
  declare detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare monitoringEvaluationPlan: string | null;

  @AllowNull
  @Column(INTEGER)
  declare pctBeneficiariesScheduledClasses: number | null;

  @AllowNull
  @Column(INTEGER)
  declare pctBeneficiariesScheduledTribes: number | null;

  @AllowNull
  @Column(TEXT)
  declare theoryOfChange: string | null;

  @AllowNull
  @Column(TEXT)
  declare proposedGovPartners: string | null;

  @AllowNull
  @Column(INTEGER)
  declare pctSchTribe: string | null;

  @AllowNull
  @Column(TEXT)
  declare sustainabilityPlan: string | null;

  @AllowNull
  @Column(TEXT)
  declare replicationPlan: string | null;

  @AllowNull
  @Column(TEXT)
  declare replicationChallenges: string | null;

  @AllowNull
  @Column(TEXT)
  declare solutionMarketSize: string | null;

  @AllowNull
  @Column(TEXT)
  declare affordabilityOfSolution: string | null;

  @AllowNull
  @Column(TEXT)
  declare growthTrendsBusiness: string | null;

  @AllowNull
  @Column(TEXT)
  declare limitationsOnScope: string | null;

  @AllowNull
  @Column(TEXT)
  declare businessModelReplicationPlan: string | null;

  @AllowNull
  @Column(TEXT)
  declare biodiversityImpact: string | null;

  @AllowNull
  @Column(TEXT)
  declare waterSource: string | null;

  @AllowNull
  @Column(TEXT)
  declare climateResilience: string | null;

  @AllowNull
  @Column(TEXT)
  declare soilHealth: string | null;

  @AllowNull
  @Column(TINYINT)
  declare pctEmployeesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesMen: number | null;

  @AllowNull
  @Column(TEXT)
  declare baselineBiodiversity: string | null;

  @AllowNull
  @Column(INTEGER)
  declare goalTreesRestoredPlanting: number | null;

  @AllowNull
  @Column(INTEGER)
  declare goalTreesRestoredAnr: number | null;

  @AllowNull
  @Column(INTEGER)
  declare goalTreesRestoredDirectSeeding: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare directSeedingSurvivalRate: number | null;

  @AllowNull
  @JsonColumn({ field: "level_0_proposed" })
  declare level0Proposed: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_1_proposed" })
  declare level1Proposed: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_2_proposed" })
  declare level2Proposed: string[] | null;

  @AllowNull
  @Column(DECIMAL(15, 8))
  declare latProposed: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 8), field: "long_proposed" })
  declare lngProposed: number | null;

  @AllowNull
  @Column(TEXT)
  declare stakeholderEngagement: string | null;

  @AllowNull
  @Column(STRING)
  declare landownerAgreement: string | null;

  @AllowNull
  @Column(TEXT)
  declare landownerAgreementDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare landTenureDistribution: string | null;

  @AllowNull
  @Column(TEXT)
  declare landTenureRisks: string | null;

  @AllowNull
  @Column(TEXT)
  declare nonTreeInterventionsDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare complementExistingRestoration: string | null;

  @AllowNull
  @Column(TEXT)
  declare landUseTypeDistribution: string | null;

  @AllowNull
  @Column(TEXT)
  declare restorationStrategyDistribution: string | null;

  @AllowNull
  @Column(INTEGER)
  declare totalTreeSecondYr: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare projSurvivalRate: number | null;

  @AllowNull
  @Column(TEXT)
  declare anrApproach: string | null;

  @AllowNull
  @Column(TEXT)
  declare anrRights: string | null;

  @AllowNull
  @Column(TEXT)
  declare projectSiteModel: string | null;

  @AllowNull
  @Column(TEXT)
  declare indigenousImpact: string | null;

  @AllowNull
  @JsonColumn()
  declare barriersProjectActivity: string | null;

  @AllowNull
  @Column(TEXT)
  declare barriersProjectActivityDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare otherEngageWomenYouth: string | null;

  @AllowNull
  @Column(INTEGER)
  declare forestFragmentsDistance: number | null;

  @AllowNull
  @JsonColumn()
  declare anrPracticesProposed: string[] | null;

  @AllowNull
  @Column(BOOLEAN)
  declare informationAuthorization: boolean | null;

  @AllowNull
  @Column(TEXT)
  declare goalTreesRestoredDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare jobsCreatedBeneficiariesDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare consortium: string | null;
}
