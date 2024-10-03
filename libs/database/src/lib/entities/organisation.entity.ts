import {
  AllowNull,
  AutoIncrement,
  Column,
  Index,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript';
import { BIGINT, DECIMAL, ENUM, INTEGER, TEXT, TINYINT, UUID } from 'sequelize';

@Table({ tableName: 'organisations', underscored: true })
export class Organisation extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT({ unsigned: true }) })
  override id: bigint;

  @Index
  @Column({ type: UUID })
  uuid: string | null;

  @Column({ defaultValue: 'draft' })
  status: string;

  @AllowNull
  @Column
  type: string | null;

  @Column({ defaultValue: false })
  private: boolean;

  @AllowNull
  @Column
  name: string | null;

  @AllowNull
  @Column
  phone: string | null;

  @AllowNull
  @Column({ field: 'hq_street_1' })
  hqStreet1: string | null;

  @AllowNull
  @Column({ field: 'hq_street_2' })
  hqStreet2: string | null;

  @AllowNull
  @Column
  hqCity: string | null;

  @AllowNull
  @Column
  hqState: string | null;

  @AllowNull
  @Column
  hqZipcode: string | null;

  @AllowNull
  @Column
  hqCountry: string | null;

  @AllowNull
  @Column({ type: TEXT })
  leadershipTeamTxt: string | null;

  @AllowNull
  @Column
  foundingDate: Date | null;

  @AllowNull
  @Column({ type: TEXT })
  description: string | null;

  @AllowNull
  @Column({ type: TEXT })
  countries: string | null;

  @AllowNull
  @Column({ type: TEXT })
  languages: string | null;

  @AllowNull
  @Column({ type: TEXT })
  treeCareApproach: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  relevantExperienceYears: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'trees_grown_3year' })
  treesGrown3Year: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  treesGrownTotal: number | null;

  @AllowNull
  @Column({ type: DECIMAL(8, 2), field: 'ha_restored_3year' })
  haRestored3Year: number | null;

  @AllowNull
  @Column({ type: DECIMAL(10, 2) })
  haRestoredTotal: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  finStartMonth: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2) })
  finBudgetCurrentYear: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: 'fin_budget_1year' })
  finBudget1Year: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: 'fin_budget_2year' })
  finBudget2Year: number | null;

  @AllowNull
  @Column({ type: DECIMAL(15, 2), field: 'fin_budget_3year' })
  finBudget3Year: number | null;

  @AllowNull
  @Column
  webUrl: string | null;

  @AllowNull
  @Column
  facebookUrl: string | null;

  @AllowNull
  @Column
  instagramUrl: string | null;

  @AllowNull
  @Column
  linkedinUrl: string | null;

  @AllowNull
  @Column
  twitterUrl: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }) })
  ftPermanentEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }) })
  ptPermanentEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10 }) })
  tempEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }) })
  femaleEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }) })
  maleEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }) })
  youngEmployees: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10 }), field: 'over_35_employees' })
  over35Employees: number | null;

  @AllowNull
  @Column({ type: TEXT })
  additionalFundingDetails: string | null;

  @AllowNull
  @Column({ type: TEXT })
  communityExperience: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }), field: 'total_engaged_community_members_3yr' })
  totalEngagedCommunityMembers3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: 'percent_engaged_women_3yr' })
  percentEngagedWomen3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4}), field: 'percent_engaged_men_3yr' })
  percentEngagedMen3Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: 'percent_engaged_under_35_3yr' })
  percentEngagedUnder353Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: 'percent_engaged_over_35_3yr' })
  percentEngagedOver353Yr: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }), field: 'percent_engaged_smallholder_3yr' })
  percentEngagedSmallholder3Yr: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 10, unsigned: true }) })
  totalTreesGrown: number | null;

  @AllowNull
  @Column({ type: TINYINT({ length: 4 }) })
  avgTreeSurvivalRate: number | null;

  @AllowNull
  @Column({ type: TEXT })
  treeMaintenanceAftercareApproach: string | null;

  @AllowNull
  @Column({ type: TEXT })
  restoredAreasDescription: string | null;

  @AllowNull
  @Column({ type: TEXT })
  restorationTypesImplemented: string | null;

  @AllowNull
  @Column({ type: TEXT })
  historicMonitoringGeojson: string | null;

  @AllowNull
  @Column({ type: TEXT })
  monitoringEvaluationExperience: string | null;

  @AllowNull
  @Column({ type: TEXT('long') })
  fundingHistory: string | null;

  @AllowNull
  @Column({ type: TEXT })
  engagementFarmers: string | null;

  @AllowNull
  @Column({ type: TEXT })
  engagementWomen: string | null;

  @AllowNull
  @Column({ type: TEXT })
  engagementYouth: string | null;

  @Column({ defaultValue: 'USD' })
  currency: string;

  @AllowNull
  @Column({ type: TEXT })
  states: string | null;

  @AllowNull
  @Column({ type: TEXT })
  district: string | null;

  @AllowNull
  @Column({ type: TEXT, field: 'account_number_1' })
  accountNumber1: string | null;

  @AllowNull
  @Column({ type: TEXT, field: 'account_number_2' })
  accountNumber2: string | null;

  @AllowNull
  @Column({ type: TEXT })
  loanStatusAmount: string | null;

  @AllowNull
  @Column({ type: TEXT })
  loanStatusTypes: string | null;

  @AllowNull
  @Column({ type: TEXT })
  approachOfMarginalizedCommunities: string | null;

  @AllowNull
  @Column({ type: TEXT })
  communityEngagementNumbersMarginalized: string | null;

  @AllowNull
  @Column({ type: TEXT })
  landSystems: string | null;

  @AllowNull
  @Column({ type: TEXT })
  fundUtilisation: string | null;

  @AllowNull
  @Column({ type: TEXT })
  detailedInterventionTypes: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr' })
  communityMembersEngaged3yr: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr_women' })
  communityMembersEngaged3yrWomen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr_men' })
  communityMembersEngaged3yrMen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr_youth' })
  communityMembersEngaged3yrYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr_non_youth' })
  communityMembersEngaged3yrNonYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr_smallholder' })
  communityMembersEngaged3yrSmallholder: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'community_members_engaged_3yr_backward_class' })
  communityMembersEngaged3YrBackwardClass: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  totalBoardMembers: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  pctBoardWomen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  pctBoardMen: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  pctBoardYouth: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  pctBoardNonYouth: number | null;

  @AllowNull
  @Column({ type: TEXT })
  engagementNonYouth: string | null;

  @AllowNull
  @Column({ type: TEXT })
  treeRestorationPractices: string | null;

  @AllowNull
  @Column({ type: TEXT })
  businessModel: string | null;

  @AllowNull
  @Column({ type: TEXT })
  subtype: string | null;

  @AllowNull
  @Column({ type: BIGINT({ length: 20 }) })
  organisationRevenueThisYear: number | null;

  @AllowNull
  @Column({ type: TEXT })
  fieldStaffSkills: string | null;

  @AllowNull
  @Column({ type: ENUM, values: ['yes', 'no'] })
  fpcCompany: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  numOfFarmersOnBoard: number | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  numOfMarginalisedEmployees: number | null;

  @AllowNull
  @Column({ type: TEXT })
  benefactorsFpcCompany: string | null;

  @AllowNull
  @Column
  boardRemunerationFpcCompany: string | null;

  @AllowNull
  @Column
  boardEngagementFpcCompany: string | null;

  @AllowNull
  @Column
  biodiversityFocus: string | null;

  @AllowNull
  @Column({ type: TEXT })
  globalPlanningFrameworks: string | null;

  @AllowNull
  @Column({ type: TEXT })
  pastGovCollaboration: string | null;

  @AllowNull
  @Column({ type: TEXT })
  engagementLandless: string | null;

  @AllowNull
  @Column({ type: TEXT })
  socioeconomicImpact: string | null;

  @AllowNull
  @Column({ type: TEXT })
  environmentalImpact: string | null;

  // field misspelled intentionally to match the current DB schema
  @AllowNull
  @Column({ type: TEXT, field: 'growith_stage' })
  growthStage: string | null;

  @AllowNull
  @Column({ type: INTEGER({ length: 11 }) })
  totalEmployees: number | null

  @AllowNull
  @Column({ type: TEXT })
  additionalComments: string | null;
}
