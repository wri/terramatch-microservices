import { AllowNull, AutoIncrement, Column, Default, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DATE,
  DECIMAL,
  ENUM,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  TEXT,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { OrganisationStatus } from "../constants/status";
import { MediaConfiguration } from "../constants/media-owners";
import { Application } from "./application.entity";
import { Subquery } from "../util/subquery.builder";
import { removeMedia } from "../hooks/remove-media";
import { Dictionary } from "lodash";

type OrganisationMedia =
  | "logo"
  | "cover"
  | "reference"
  | "additional"
  | "bankStatements"
  | "previousAnnualReports"
  | "historicRestoration"
  | "opBudget1Year"
  | "opBudget2Year"
  | "opBudget3Year"
  | "opBudgetLastYear"
  | "opBudgetThisYear"
  | "opBudgetNextYear"
  | "legalRegistration"
  | "avgTreeSurvivalRateProof"
  | "equityOwnership"
  | "loanStatus"
  | "restorationPhotos"
  | "organisationFile"
  | "organisationPhoto"
  | "startupRecognitionCert"
  | "fundingTypeDocuments"
  | "consortiumProof"
  | "consortiumPartnershipAgreements"
  | "organogram"
  | "ownershipDocuments"
  | "carbonCreditsProof"
  | "additionalFinancialDocumentation";

const READABLE_TYPES: Dictionary<string> = {
  "for-profit-organization": "For Profit Organization",
  "non-profit-organization": "Non Profit Organization",
  "government-agency": "Government Agency"
};

@Table({ tableName: "organisations", underscored: true, paranoid: true, hooks: { afterDestroy: removeMedia } })
export class Organisation extends Model<InferAttributes<Organisation>, InferCreationAttributes<Organisation>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Organisation";

  static readonly MEDIA: Record<OrganisationMedia, MediaConfiguration> = {
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
    carbonCreditsProof: { dbCollection: "carbon_credits_proof", multiple: true, validation: "general-documents" },
    additionalFinancialDocumentation: {
      dbCollection: "additional_financial_documentation",
      multiple: true,
      validation: "general-documents"
    }
  };

  static uuidForFundingProgramme(fundingProgrammeUuid: string) {
    return Subquery.select(Application, "organisationUuid").eq("fundingProgrammeUuid", fundingProgrammeUuid).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Default("draft")
  @Column(STRING)
  declare status: CreationOptional<OrganisationStatus>;

  @AllowNull
  @Column(STRING)
  declare type: string | null;

  get readableType(): CreationOptional<string> {
    return (this.type != null ? READABLE_TYPES[this.type] : undefined) ?? "Unknown";
  }

  @Default(false)
  @Column(BOOLEAN)
  declare private: CreationOptional<boolean>;

  @Default(false)
  @Column(BOOLEAN)
  declare isTest: CreationOptional<boolean>;

  @AllowNull
  @Column(STRING)
  declare name: string | null;

  @AllowNull
  @Column(STRING)
  declare phone: string | null;

  @AllowNull
  @Column({ type: STRING, field: "hq_street_1" })
  declare hqStreet1: string | null;

  @AllowNull
  @Column({ type: STRING, field: "hq_street_2" })
  declare hqStreet2: string | null;

  @AllowNull
  @Column(STRING)
  declare hqCity: string | null;

  @AllowNull
  @Column(STRING)
  declare hqState: string | null;

  @AllowNull
  @Column(STRING)
  declare hqZipcode: string | null;

  @AllowNull
  @Column(STRING)
  declare hqCountry: string | null;

  @AllowNull
  @Column(TEXT)
  declare leadershipTeamTxt: string | null;

  @AllowNull
  @Column(DATE)
  declare foundingDate: Date | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @JsonColumn()
  declare countries: string[] | null;

  @AllowNull
  @JsonColumn()
  declare languages: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare treeCareApproach: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare relevantExperienceYears: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "trees_grown_3year" })
  declare treesGrown3Year: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare treesGrownTotal: number | null;

  @AllowNull
  @Column({ type: DECIMAL(8, 2), field: "ha_restored_3year" })
  declare haRestored3Year: number | null;

  @AllowNull
  @Column(DECIMAL(10, 2))
  declare haRestoredTotal: number | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare finStartMonth: number | null;

  @AllowNull
  @Column(STRING)
  declare webUrl: string | null;

  @AllowNull
  @Column(STRING)
  declare facebookUrl: string | null;

  @AllowNull
  @Column(STRING)
  declare instagramUrl: string | null;

  @AllowNull
  @Column(STRING)
  declare linkedinUrl: string | null;

  @AllowNull
  @Column(STRING)
  declare twitterUrl: string | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  declare ftPermanentEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  declare ptPermanentEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10 }))
  declare tempEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  declare femaleEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  declare maleEmployees: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  declare youngEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10 }), field: "over_35_employees" })
  declare over35Employees: number | null;

  @AllowNull
  @Column(TEXT)
  declare additionalFundingDetails: string | null;

  @AllowNull
  @Column(TEXT)
  declare communityExperience: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }), field: "total_engaged_community_members_3yr" })
  declare totalEngagedCommunityMembers3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_women_3yr" })
  declare percentEngagedWomen3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_men_3yr" })
  declare percentEngagedMen3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_under_35_3yr" })
  declare percentEngagedUnder353Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_over_35_3yr" })
  declare percentEngagedOver353Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: "percent_engaged_smallholder_3yr" })
  declare percentEngagedSmallholder3Yr: number | null;

  @AllowNull
  @Column(INTEGER({ length: 10, unsigned: true }))
  declare totalTreesGrown: number | null;

  @AllowNull
  @Column(TINYINT({ length: 4 }))
  declare avgTreeSurvivalRate: number | null;

  @AllowNull
  @Column(TEXT)
  declare treeMaintenanceAftercareApproach: string | null;

  @AllowNull
  @Column(TEXT)
  declare restoredAreasDescription: string | null;

  @AllowNull
  @JsonColumn()
  declare restorationTypesImplemented: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare historicMonitoringGeojson: string | null;

  @AllowNull
  @Column(TEXT)
  declare monitoringEvaluationExperience: string | null;

  @AllowNull
  @Column(TEXT("long"))
  declare fundingHistory: string | null;

  @AllowNull
  @JsonColumn()
  declare engagementFarmers: string[] | null;

  @AllowNull
  @JsonColumn()
  declare engagementWomen: string[] | null;

  @AllowNull
  @JsonColumn()
  declare engagementYouth: string[] | null;

  @Default("USD")
  @Column(STRING)
  declare currency: CreationOptional<string>;

  @AllowNull
  @JsonColumn()
  declare states: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare district: string | null;

  @AllowNull
  @Column({ type: TEXT, field: "account_number_1" })
  declare accountNumber1: string | null;

  @AllowNull
  @Column({ type: TEXT, field: "account_number_2" })
  declare accountNumber2: string | null;

  @AllowNull
  @Column(DECIMAL(15, 2))
  declare loanStatusAmount: number | null;

  @AllowNull
  @JsonColumn()
  declare loanStatusTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare approachOfMarginalizedCommunities: string | null;

  @AllowNull
  @Column(TEXT)
  declare communityEngagementNumbersMarginalized: string | null;

  @AllowNull
  @JsonColumn()
  declare landSystems: string[] | null;

  @AllowNull
  @JsonColumn()
  declare fundUtilisation: string[] | null;

  @AllowNull
  @JsonColumn()
  declare detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr" })
  declare communityMembersEngaged3yr: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_women" })
  declare communityMembersEngaged3yrWomen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_men" })
  declare communityMembersEngaged3yrMen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_youth" })
  declare communityMembersEngaged3yrYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_non_youth" })
  declare communityMembersEngaged3yrNonYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_smallholder" })
  declare communityMembersEngaged3yrSmallholder: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: "community_members_engaged_3yr_backward_class" })
  declare communityMembersEngaged3YrBackwardClass: number | null;

  @AllowNull
  @Column(TEXT)
  declare engagementNonYouth: string | null;

  @AllowNull
  @JsonColumn()
  declare treeRestorationPractices: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare businessModel: string | null;

  @AllowNull
  @Column(TEXT)
  declare subtype: string | null;

  @AllowNull
  @Column(TEXT)
  declare fieldStaffSkills: string | null;

  @AllowNull
  @Column({ type: ENUM, values: ["yes", "no"] })
  declare fpcCompany: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare numOfMarginalisedEmployees: number | null;

  @AllowNull
  @Column(TEXT)
  declare benefactorsFpcCompany: string | null;

  @AllowNull
  @Column(STRING)
  declare boardRemunerationFpcCompany: string | null;

  @AllowNull
  @Column(STRING)
  declare boardEngagementFpcCompany: string | null;

  @AllowNull
  @JsonColumn()
  declare biodiversityFocus: string[] | null;

  @AllowNull
  @JsonColumn()
  declare globalPlanningFrameworks: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare pastGovCollaboration: string | null;

  @AllowNull
  @Column(TEXT)
  declare engagementLandless: string | null;

  @AllowNull
  @Column(TEXT)
  declare socioeconomicImpact: string | null;

  @AllowNull
  @Column(TEXT)
  declare environmentalImpact: string | null;

  // field misspelled intentionally to match the current DB schema
  @AllowNull
  @Column({ type: TEXT, field: "growith_stage" })
  declare growthStage: string | null;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare totalEmployees: number | null;

  @AllowNull
  @Column(TEXT)
  declare additionalComments: string | null;

  @AllowNull
  @Column(TEXT)
  declare femaleYouthLeadershipExample: string | null;

  @AllowNull
  @JsonColumn({ field: "level_0_past_restoration" })
  declare level0PastRestoration: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_1_past_restoration" })
  declare level1PastRestoration: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_2_past_restoration" })
  declare level2PastRestoration: string[] | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare treesNaturallyRegeneratedTotal: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED, field: "trees_naturally_regenerated_3year" })
  declare treesNaturallyRegenerated3Year: number | null;

  @AllowNull
  @Column(TEXT)
  declare externalTechnicalAssistance: string | null;

  @AllowNull
  @Column(TEXT)
  declare barriersToFunding: string | null;

  @AllowNull
  @Column(TEXT)
  declare capacityBuildingSupportNeeded: string | null;

  @AllowNull
  @Column(BOOLEAN)
  declare associationsCooperatives: boolean | null;

  @AllowNull
  @JsonColumn()
  declare territoriesOfOperation: string[] | null;

  @AllowNull
  @Column({ type: TEXT, field: "decisionmaking_structure_description" })
  declare decisionMakingStructureDescription: string | null;

  @AllowNull
  @Column({ type: TEXT, field: "decisionmaking_structure_individuals_involved" })
  declare decisionMakingStructureIndividualsInvolved: string | null;

  @AllowNull
  @Column(DECIMAL(15, 2))
  declare averageWorkerIncome: number | null;

  @AllowNull
  @JsonColumn()
  declare anrPracticesPast: string[] | null;

  @AllowNull
  @JsonColumn()
  declare anrMonitoringApproaches: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare anrMonitoringApproachesDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare anrCommunicationFunders: string | null;

  @AllowNull
  @Column(TEXT)
  declare bioeconomyProducts: string | null;

  @AllowNull
  @Column(TEXT)
  declare bioeconomyTraditionalKnowledge: string | null;

  @AllowNull
  @Column(TEXT)
  declare bioeconomyProductProcessing: string | null;

  @AllowNull
  @Column(TEXT)
  declare bioeconomyBuyers: string | null;

  @AllowNull
  @JsonColumn()
  declare bioeconomyProductList: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare bioeconomyDescription: string | null;
}
