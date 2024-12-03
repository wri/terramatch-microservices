import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, DECIMAL, ENUM, INTEGER, STRING, TEXT, TINYINT, UUID } from "sequelize";
import { Organisation } from "./organisation.entity";

@Table({ tableName: "v2_projects", underscored: true, paranoid: true })
export class Project extends Model<Project> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: string | null;

  @Default(false)
  @Column(BOOLEAN)
  isTest: boolean;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  @AllowNull
  @ForeignKey(() => Organisation)
  organisationId: number | null;

  // TODO once the Application record has been added
  // @AllowNull
  // @ForeignKey(() => Application)
  // applicationId: number | null;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @AllowNull
  @Default("no-update")
  @Column(STRING)
  updateRequestStatus: string | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @Column(TEXT)
  feedbackFields: string | null;

  @AllowNull
  @Column(ENUM("new_project", "existing_expansion"))
  projectStatus: string | null;

  @AllowNull
  @Column(TEXT("long"))
  boundaryGeojson: string | null;

  @AllowNull
  @Column(TEXT)
  landUseTypes: string | null;

  @AllowNull
  @Column(TEXT)
  restorationStrategy: string | null;

  @AllowNull
  @Column(TEXT)
  country: string | null;

  @AllowNull
  @Column(TEXT)
  continent: string | null;

  @AllowNull
  @Column(DATE)
  plantingStartDate: Date;

  @AllowNull
  @Column(DATE)
  plantingEndDate: Date;

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
  projectCountryDistrict: string | null;

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
  @Column(TEXT)
  landTenureProjectArea: string | null;

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
  @Column({ type: TINYINT, field: "pct_employees_18t35" })
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
  detailedInterventionTypes: string | null;

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
  @Column(TEXT)
  states: string | null;

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

  async loadOrganisation() {
    if (this.organisation == null && this.organisationId != null) {
      this.organisation = await this.$get("organisation");
    }
    return this.organisation;
  }
}
