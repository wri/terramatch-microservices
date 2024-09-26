import {
  BaseEntity,
  Column,
  CreateDateColumn, DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'organisations' })
export class Organisation extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'char', width: 36 })
  @Index()
  uuid: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', name: 'deleted_at' })
  deletedAt: Date;

  @Column({ default: 'draft' })
  status: string;

  @Column({ nullable: true })
  type: string | null;

  @Column({ width: 1 })
  private: boolean;

  @Column({ nullable: true})
  name: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ name: 'hq_street_1', nullable: true })
  hqStreet1: string | null;

  @Column({ name: 'hq_street_2', nullable: true })
  hqStreet2: string | null;

  @Column({ name: 'hq_city', nullable: true })
  hqCity: string | null;

  @Column({ name: 'hq_state', nullable: true })
  hqState: string | null;

  @Column({ name: 'hq_zipcode', nullable: true })
  hqZipCode: string | null;

  @Column({ name: 'hq_country', nullable: true })
  hqCountry: string | null;

  @Column({ type: 'text', name: 'leadership_team_txt', nullable: true })
  leadershipTeamTxt: string | null;

  @Column({ name: 'founding_date', nullable: true })
  foundingDate: Date | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  countries: string | null;

  @Column({ type: 'text', nullable: true })
  languages: string | null;

  @Column({ type: 'text', name: 'tree_care_approach', nullable: true })
  treeCareApproach: string | null;

  @Column({ type: 'int', name: 'relevant_experience_years', width: 11, nullable: true })
  relevantExperienceYears: number | null;

  @Column({ type: 'int', name: 'trees_grown_3year', width: 11, nullable: true })
  treesGrown3Year: number | null;

  @Column({ type: 'int', name: 'trees_grown_total', width: 11, nullable: true })
  treesGrownTotal: number | null;

  @Column({ type: 'decimal', name: 'ha_restored_3year', precision: 8, scale: 2, nullable: true })
  haRestored3Year: number | null;

  @Column({ type: 'decimal', name: 'ha_restored_total', precision: 10, scale: 2, nullable: true })
  haRestoredTotal: number | null;

  @Column({ type: 'int', name: 'fin_start_month', width: 11, nullable: true })
  finStartMonth: number | null;

  @Column({ type: 'decimal', name: 'ha_restored_total', precision: 15, scale: 2, nullable: true })
  finBudgetCurrentYear: number | null;

  @Column({ type: 'decimal', name: 'ha_restored_total', precision: 15, scale: 2, nullable: true })
  finBudget1Year: number | null;

  @Column({ type: 'decimal', name: 'ha_restored_total', precision: 15, scale: 2, nullable: true })
  finBudget2Year: number | null;

  @Column({ type: 'decimal', name: 'ha_restored_total', precision: 15, scale: 2, nullable: true })
  finBudget3Year: number | null;

  @Column({ name: 'web_url', nullable: true})
  webUrl: string | null;

  @Column({ name: 'facebook_url', nullable: true})
  facebookUrl: string | null;

  @Column({ name: 'instagram_url', nullable: true})
  instagramUrl: string | null;

  @Column({ name: 'linkedin_url', nullable: true})
  linkedInUrl: string | null;

  @Column({ name: 'twitter_url', nullable: true})
  twitterUrl: string | null;

  @Column({ type: 'int', unsigned: true, name: 'ft_permanent_employees', width: 10, nullable: true })
  ftPermanentEmployees: number | null;

  @Column({ type: 'int', unsigned: true, name: 'pt_permanent_employees', width: 10, nullable: true })
  ptPermanentEmployees: number | null;

  @Column({ type: 'int', unsigned: true, name: 'temp_employees', width: 10, nullable: true })
  tempEmployees: number | null;

  @Column({ type: 'int', unsigned: true, name: 'female_employees', width: 10, nullable: true })
  femaleEmployees: number | null;

  @Column({ type: 'int', unsigned: true, name: 'male_employees', width: 10, nullable: true })
  maleEmployees: number | null;

  @Column({ type: 'int', unsigned: true, name: 'young_employees', width: 10, nullable: true })
  youngEmployees: number | null;

  @Column({ type: 'int', name: 'ft_permanent_employees', width: 10, nullable: true })
  over35Employees: number | null;

  @Column({ type: 'text', name: 'additional_funding_details', nullable: true })
  additionalFundingDetails: string | null;

  @Column({ type: 'text', name: 'community_experience', nullable: true })
  communityExperience: string | null;

  @Column({ type: 'int', unsigned: true, name: 'total_engaged_community_members_3yr', width: 10, nullable: true })
  totalEngagedCommunityMembers3Yr: number | null;

  @Column({ type: 'tinyint', name: 'percent_engaged_women_3yr', width: 4, nullable: true })
  percentEngagedWomen3Yr: number | null;

  @Column({ type: 'tinyint', name: 'percent_engaged_men_3yr', width: 4, nullable: true })
  percentEngagedMen3Yr: number | null;

  @Column({ type: 'tinyint', name: 'percent_engaged_under_35_3yr', width: 4, nullable: true })
  percentEngagedUnder353Yr: number | null;

  @Column({ type: 'tinyint', name: 'percent_engaged_over_35_3yr', width: 4, nullable: true })
  percentEngagedOver353Yr: number | null;

  @Column({ type: 'tinyint', name: 'percent_engaged_smallholder_3yr', width: 4, nullable: true })
  percentEngagedSmallholder3Yr: number | null;

  @Column({ type: 'int', unsigned: true, name: 'total_trees_grown', width: 10, nullable: true })
  totalTreesGrown: number | null;

  @Column({ type: 'tinyint', name: 'avg_tree_survival_rate', width: 4, nullable: true })
  avgTreeSurvivalRate: number | null;

  @Column({ type: 'text', name: 'tree_maintenance_aftercare_approach', nullable: true })
  treeMaintenanceAftercareApproach: string | null;

  @Column({ type: 'text', name: 'restored_areas_description', nullable: true })
  restoredAreasDescription: string | null;

  @Column({ type: 'text', name: 'restoration_types_implemented', nullable: true })
  restorationTypesImplemented: string | null;

  @Column({ type: 'text', name: 'historic_monitoring_geojson', nullable: true })
  historicMonitoringGeojson: string | null;

  @Column({ type: 'text', name: 'monitoring_evaluation_experience', nullable: true })
  monitoringEvaluationExperience: string | null;

  @Column({ type: 'longtext', name: 'funding_history', nullable: true})
  fundingHistory: string | null;

  @Column({ type: 'text', name: 'engagement_farmers', nullable: true })
  engagementFarmers: string | null;

  @Column({ type: 'text', name: 'engagement_women', nullable: true })
  engagementWomen: string | null;

  @Column({ type: 'text', name: 'engagement_youth', nullable: true })
  engagementYouth: string | null;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  states: string | null;

  @Column({ type: 'text', nullable: true })
  district: string | null;

  @Column({ type: 'text', name: 'account_number_1', nullable: true })
  accountNumber1: string | null;

  @Column({ type: 'text', name: 'account_number_2', nullable: true })
  accountNumber2: string | null;

  @Column({ type: 'text', name: 'loan_status_amount', nullable: true })
  loanStatusAmount: string | null;

  @Column({ type: 'text', name: 'loan_status_types', nullable: true })
  loanStatusTypes: string | null;

  @Column({ type: 'text', name: 'approach_of_marginalized_communities', nullable: true })
  approachOfMarginalizedCommunities: string | null;

  @Column({ type: 'text', name: 'community_engagement_numbers_marginalized', nullable: true })
  communityEngagementNumbersMarginalized: string | null;

  @Column({ type: 'text', name: 'land_systems', nullable: true })
  landSystems: string | null;

  @Column({ type: 'text', name: 'fund_utilisation', nullable: true })
  fundUtilisation: string | null;

  @Column({ type: 'text', name: 'detailed_intervention_types', nullable: true })
  detailedInterventionTypes: string | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr', width: 11, nullable: true })
  communityMembersEngaged3yr: number | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr_women', width: 11, nullable: true })
  communityMembersEngaged3yrWomen: number | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr_men', width: 11, nullable: true })
  communityMembersEngaged3yrMen: number | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr_youth', width: 11, nullable: true })
  communityMembersEngaged3yrYouth: number | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr_non_youth', width: 11, nullable: true })
  communityMembersEngaged3yrNonYouth: number | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr_smallholder', width: 11, nullable: true })
  communityMembersEngaged3yrSmallholder: number | null;

  @Column({ type: 'int', name: 'community_members_engaged_3yr_backward_class', width: 11, nullable: true })
  communityMembersEngaged3YrBackwardClass: number | null;

  @Column({ type: 'int', name: 'total_board_members', width: 11, nullable: true })
  totalBoardMembers: number | null;

  @Column({ type: 'int', name: 'pct_board_women', width: 11, nullable: true })
  pctBoardWomen: number | null;

  @Column({ type: 'int', name: 'pct_board_men', width: 11, nullable: true })
  pctBoardMen: number | null;

  @Column({ type: 'int', name: 'pct_board_youth', width: 11, nullable: true })
  pctBoardYouth: number | null;

  @Column({ type: 'int', name: 'pct_board_non_youth', width: 11, nullable: true })
  pctBoardNonYouth: number | null;

  @Column({ type: 'text', name: 'engagement_non_youth', nullable: true })
  engagementNonYouth: string | null;

  @Column({ type: 'text', name: 'tree_restoration_practices', nullable: true })
  treeRestorationPractices: string | null;

  @Column({ type: 'text', name: 'business_model', nullable: true })
  businessModel: string | null;

  @Column({ type: 'text', nullable: true })
  subtype: string | null;

  @Column({ type: 'bigint', name: 'organisation_revenue_this_year', width: 20, nullable: true })
  organisationRevenueThisYear: number | null;

  @Column({ type: 'text', name: 'field_staff_skills', nullable: true })
  fieldStaffSkills: string | null;

  @Column({ type: 'enum', enum: ['yes', 'no'], name: 'fpc_company', nullable: true })
  fpcCompany: string | null;

  @Column({ type: 'int', name: 'num_of_farmers_on_board', width: 11, nullable: true })
  numOfFarmersOnBoard: number | null;

  @Column({ type: 'int', name: 'num_of_marginalised_employees', width: 11, nullable: true })
  numOfMarginalisedEmployees: number | null;

  @Column({ type: 'text', name: 'benefactors_fpc_company', nullable: true })
  benefactorsFpcCompany: string | null;

  @Column({ name: 'board_remuneration_fpc_company', nullable: true })
  boardRemunerationFpcCompany: string | null;

  @Column({ name: 'board_engagement_fpc_company', nullable: true })
  boardEngagementFpcCompany: string | null;

  @Column({ name: 'biodiversity_focus', nullable: true })
  biodiversityFocus: string | null;

  @Column({ type: 'text', name: 'global_planning_frameworks', nullable: true })
  globalPlanningFrameworks: string | null;

  @Column({ type: 'text', name: 'past_gov_collaboration', nullable: true })
  pastGovCollaboration: string | null;

  @Column({ type: 'text', name: 'engagement_landless', nullable: true })
  engagementLandless: string | null;

  @Column({ type: 'text', name: 'socioeconomic_impact', nullable: true })
  socioeconomicImpact: string | null;

  @Column({ type: 'text', name: 'environmental_impact', nullable: true })
  environmentalImpact: string | null;

  // name misspelled intentionally to match the current DB schema
  @Column({ type: 'text', name: 'growith_stage', nullable: true })
  growthStage: string | null;

  @Column({ type: 'int', name: 'total_employees', width: 11, nullable: true })
  totalEmployees: number | null

  @Column({ type: 'text', name: 'additional_comments', nullable: true })
  additionalComments: string | null;
}
