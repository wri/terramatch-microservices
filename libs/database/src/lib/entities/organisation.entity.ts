import { AllowNull, AutoIncrement, Column, Default, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, DECIMAL, ENUM, INTEGER, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { OrganisationStatus } from "../constants/status";

@Table({ tableName: "organisations", underscored: true, paranoid: true })
export class Organisation extends Model<Organisation> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Organisation";

  static readonly MEDIA = {
    logo: { dbCollection: "logo", multiple: false, validation: "logo-image" },
    cover: { dbCollection: "cover", multiple: false, validation: "cover-image" },
    reference: { dbCollection: "reference", multiple: true, validation: "pdf" },
    additional: { dbCollection: "additional", multiple: true, validation: "general-documents" },
    bankStatements: { dbCollection: "bank_statements", multiple: true, validation: "general-documents" },
    previousAnnualReports: { dbCollection: "previous_annual_reports", multiple: true, validation: "general-documents" },
    historicRestoration: { dbCollection: "historic_restoration", multiple: true, validation: "photos" },
    opBudget1Year: { dbCollection: "op_budget_1year", multiple: true, validation: "spreadsheet" },
    opBudget2Year: { dbCollection: "op_budget_2year", multiple: true, validation: "spreadsheet" },
    opBudget3Year: { dbCollection: "op_budget_3year", multiple: true, validation: "spreadsheet" },
    opBudgetLastYear: { dbCollection: "op_budget_last_year", multiple: true, validation: "spreadsheet" },
    opBudgetThisYear: { dbCollection: "op_budget_this_year", multiple: true, validation: "spreadsheet" },
    opBudgetNextYear: { dbCollection: "op_budget_next_year", multiple: true, validation: "spreadsheet" },
    legalRegistration: { dbCollection: "legal_registration", multiple: true, validation: "general-documents" },
    avgTreeSurvivalRateProof: {
      dbCollection: "avg_tree_survival_rate_proof",
      multiple: true,
      validation: "general-documents"
    },
    equityOwnership: { dbCollection: "equity_ownership", multiple: false, validation: "spreadsheet" },
    loanStatus: { dbCollection: "loan_status", multiple: true, validation: "general-documents" },
    restorationPhotos: { dbCollection: "restoration_photos", multiple: true, validation: "photos" },
    organisationFile: { dbCollection: "organisation_file", multiple: true, validation: "general-documents" },
    organisationPhoto: { dbCollection: "organisation_photo", multiple: true, validation: "photos" },
    startupRecognitionCert: { dbCollection: "startup_recognition_cert", multiple: false, validation: "documents" },
    fundingTypeDocuments: { dbCollection: "funding_type_documents", multiple: true, validation: "general-documents" },
    consortiumProof: { dbCollection: "consortium_proof", multiple: true, validation: "general-documents" },
    consortiumPartnershipAgreements: {
      dbCollection: "consortium_partnership_agreements",
      multiple: true,
      validation: "general-documents"
    },
    organogram: { dbCollection: "organogram", multiple: true, validation: "general-documents" },
    ownershipDocuments: { dbCollection: "ownership_documents", multiple: true, validation: "general-documents" },
    carbonCreditsProof: { dbCollection: "carbon_credits_proof", multiple: true, validation: "general-documents" }
  } as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Default("draft")
  @Column(STRING)
  status: OrganisationStatus;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @Default(false)
  @Column(BOOLEAN)
  private: boolean;

  @Default(false)
  @Column(BOOLEAN)
  isTest: boolean;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @Column(STRING)
  phone: string | null;

  @AllowNull
  @Column({ type: STRING, field: "hq_street_1" })
  hqStreet1: string | null;

  @AllowNull
  @Column({ type: STRING, field: "hq_street_2" })
  hqStreet2: string | null;

  @AllowNull
  @Column(STRING)
  hqCity: string | null;

  @AllowNull
  @Column(STRING)
  hqState: string | null;

  @AllowNull
  @Column(STRING)
  hqZipcode: string | null;

  @AllowNull
  @Column(STRING)
  hqCountry: string | null;

  @AllowNull
  @Column(TEXT)
  leadershipTeamTxt: string | null;

  @AllowNull
  @Column(DATE)
  foundingDate: Date | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @JsonColumn()
  countries: string[] | null;

  @AllowNull
  @JsonColumn()
  languages: string[] | null;

  @AllowNull
  @Column(TEXT)
  treeCareApproach: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  relevantExperienceYears: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "trees_grown_3year" })
  treesGrown3Year: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  treesGrownTotal: number | null;

  @AllowNull
  @Column({ type: DECIMAL(8, 2), field: "ha_restored_3year" })
  haRestored3Year: number | null;

  @AllowNull
  @Column(DECIMAL(10, 2))
  haRestoredTotal: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  finStartMonth: number | null;

  @AllowNull
  @Column(DECIMAL(15, 2))
  finBudgetCurrentYear: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: "fin_budget_1year" })
  finBudget1Year: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: "fin_budget_2year" })
  finBudget2Year: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: "fin_budget_3year" })
  finBudget3Year: number | null;

  @AllowNull
  @Column(STRING)
  webUrl: string | null;

  @AllowNull
  @Column(STRING)
  facebookUrl: string | null;

  @AllowNull
  @Column(STRING)
  instagramUrl: string | null;

  @AllowNull
  @Column(STRING)
  linkedinUrl: string | null;

  @AllowNull
  @Column(STRING)
  twitterUrl: string | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  ftPermanentEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  ptPermanentEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10 }))
  tempEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  femaleEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  maleEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  youngEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10 }), field: "over_35_employees" })
  over35Employees: number | null;

  @AllowNull
  @Column(TEXT)
  additionalFundingDetails: string | null;

  @AllowNull
  @Column(TEXT)
  communityExperience: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }), field: "total_engaged_community_members_3yr" })
  totalEngagedCommunityMembers3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_women_3yr" })
  percentEngagedWomen3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_men_3yr" })
  percentEngagedMen3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_under_35_3yr" })
  percentEngagedUnder353Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_over_35_3yr" })
  percentEngagedOver353Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_smallholder_3yr" })
  percentEngagedSmallholder3Yr: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  totalTreesGrown: number | null;

  @AllowNull
  @Column(TINYINT({ length: 4 }))
  avgTreeSurvivalRate: number | null;

  @AllowNull
  @Column(TEXT)
  treeMaintenanceAftercareApproach: string | null;

  @AllowNull
  @Column(TEXT)
  restoredAreasDescription: string | null;

  @AllowNull
  @JsonColumn()
  restorationTypesImplemented: string[] | null;

  @AllowNull
  @Column(TEXT)
  historicMonitoringGeojson: string | null;

  @AllowNull
  @Column(TEXT)
  monitoringEvaluationExperience: string | null;

  @AllowNull
  @Column(TEXT("long"))
  fundingHistory: string | null;

  @AllowNull
  @JsonColumn()
  engagementFarmers: string[] | null;

  @AllowNull
  @JsonColumn()
  engagementWomen: string[] | null;

  @AllowNull
  @JsonColumn()
  engagementYouth: string[] | null;

  @Default("usd")
  @Column(STRING)
  currency: string;

  @AllowNull
  @JsonColumn()
  states: string[] | null;

  @AllowNull
  @Column(TEXT)
  district: string | null;

  @AllowNull
  @Column({ type: TEXT, field: "account_number_1" })
  accountNumber1: string | null;

  @AllowNull
  @Column({ type: TEXT, field: "account_number_2" })
  accountNumber2: string | null;

  @AllowNull
  @Column(TEXT)
  loanStatusAmount: string | null;

  @AllowNull
  @JsonColumn()
  loanStatusTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  approachOfMarginalizedCommunities: string | null;

  @AllowNull
  @Column(TEXT)
  communityEngagementNumbersMarginalized: string | null;

  @AllowNull
  @JsonColumn()
  landSystems: string[] | null;

  @AllowNull
  @JsonColumn()
  fundUtilisation: string[] | null;

  @AllowNull
  @JsonColumn()
  detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr" })
  communityMembersEngaged3yr: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_women" })
  communityMembersEngaged3yrWomen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_men" })
  communityMembersEngaged3yrMen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_youth" })
  communityMembersEngaged3yrYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_non_youth" })
  communityMembersEngaged3yrNonYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_smallholder" })
  communityMembersEngaged3yrSmallholder: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_backward_class" })
  communityMembersEngaged3YrBackwardClass: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  totalBoardMembers: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  pctBoardWomen: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  pctBoardMen: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  pctBoardYouth: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  pctBoardNonYouth: number | null;

  @AllowNull
  @Column(TEXT)
  engagementNonYouth: string | null;

  @AllowNull
  @JsonColumn()
  treeRestorationPractices: string[] | null;

  @AllowNull
  @Column(TEXT)
  businessModel: string | null;

  @AllowNull
  @Column(TEXT)
  subtype: string | null;

  @AllowNull
  @Column(BIGINT({ length: 20 }))
  organisationRevenueThisYear: number | null;

  @AllowNull
  @Column(TEXT)
  fieldStaffSkills: string | null;

  @AllowNull
  @Column({ type: ENUM, values: ["yes", "no"] })
  fpcCompany: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  numOfFarmersOnBoard: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  numOfMarginalisedEmployees: number | null;

  @AllowNull
  @Column(TEXT)
  benefactorsFpcCompany: string | null;

  @AllowNull
  @Column(STRING)
  boardRemunerationFpcCompany: string | null;

  @AllowNull
  @Column(STRING)
  boardEngagementFpcCompany: string | null;

  @AllowNull
  @JsonColumn()
  biodiversityFocus: string[] | null;

  @AllowNull
  @JsonColumn()
  globalPlanningFrameworks: string[] | null;

  @AllowNull
  @Column(TEXT)
  pastGovCollaboration: string | null;

  @AllowNull
  @Column(TEXT)
  engagementLandless: string | null;

  @AllowNull
  @Column(TEXT)
  socioeconomicImpact: string | null;

  @AllowNull
  @Column(TEXT)
  environmentalImpact: string | null;

  // field misspelled intentionally to match the current DB schema
  @AllowNull
  @Column({ type: TEXT, field: "growith_stage" })
  growthStage: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  totalEmployees: number | null;

  @AllowNull
  @Column(TEXT)
  additionalComments: string | null;

  @AllowNull
  @Column(TEXT)
  consortium: string | null;

  @AllowNull
  @Column(TEXT)
  femaleYouthLeadershipExample: string | null;

  @AllowNull
  @JsonColumn({ field: "level_0_past_restoration" })
  level0PastRestoration: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_1_past_restoration" })
  level1PastRestoration: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_2_past_restoration" })
  level2PastRestoration: string[] | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  treesNaturallyRegeneratedTotal: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED, field: "trees_naturally_regenerated_3year" })
  treesNaturallyRegenerated3Year: number | null;

  @AllowNull
  @Column(TEXT)
  externalTechnicalAssistance: string | null;

  @AllowNull
  @Column(TEXT)
  barriersToFunding: string | null;

  @AllowNull
  @Column(TEXT)
  capacityBuildingSupportNeeded: string | null;
}
