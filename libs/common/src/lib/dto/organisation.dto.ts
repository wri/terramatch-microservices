/* istanbul ignore file */
import { JsonApiDto } from "../decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "./json-api-attributes";
import { Organisation } from "@terramatch-microservices/database/entities";
import { HybridSupportProps } from "./hybrid-support.dto";

const STATUSES = ["draft", "pending", "approved", "rejected"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "organisations" })
export class OrganisationLightDto {
  constructor(org?: Organisation, props?: HybridSupportProps<OrganisationLightDto, Organisation>) {
    if (org != null) {
      const mergedProps = props != null ? { lightResource: true, ...props } : { lightResource: true };
      populateDto<OrganisationLightDto, Organisation>(this, org, mergedProps);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: STATUSES })
  status: Status;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;
}

@JsonApiDto({ type: "organisations" })
export class OrganisationFullDto extends OrganisationLightDto {
  constructor(org: Organisation, props?: HybridSupportProps<OrganisationFullDto, Organisation>) {
    super();
    const mergedProps = props != null ? { lightResource: false, ...props } : { lightResource: false };
    populateDto<OrganisationFullDto, Organisation>(this, org, mergedProps);
  }

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty()
  private: boolean;

  @ApiProperty()
  isTest: boolean;

  @ApiProperty({ nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ nullable: true, type: String })
  hqStreet1: string | null;

  @ApiProperty({ nullable: true, type: String })
  hqStreet2: string | null;

  @ApiProperty({ nullable: true, type: String })
  hqCity: string | null;

  @ApiProperty({ nullable: true, type: String })
  hqState: string | null;

  @ApiProperty({ nullable: true, type: String })
  hqZipcode: string | null;

  @ApiProperty({ nullable: true, type: String })
  hqCountry: string | null;

  @ApiProperty({ nullable: true, type: String })
  leadershipTeamTxt: string | null;

  @ApiProperty({ nullable: true, type: Date })
  foundingDate: Date | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  countries: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  languages: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  treeCareApproach: string | null;

  @ApiProperty({ nullable: true, type: Number })
  relevantExperienceYears: number | null;

  @ApiProperty({ nullable: true, type: Number })
  treesGrown3Year: number | null;

  @ApiProperty({ nullable: true, type: Number })
  treesGrownTotal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  haRestored3Year: number | null;

  @ApiProperty({ nullable: true, type: Number })
  haRestoredTotal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  finStartMonth: number | null;

  @ApiProperty({ nullable: true, type: String })
  webUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  facebookUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  instagramUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  linkedinUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  twitterUrl: string | null;

  @ApiProperty({ nullable: true, type: Number })
  ftPermanentEmployees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  ptPermanentEmployees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  tempEmployees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  femaleEmployees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  maleEmployees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  youngEmployees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  over35Employees: number | null;

  @ApiProperty({ nullable: true, type: String })
  additionalFundingDetails: string | null;

  @ApiProperty({ nullable: true, type: String })
  communityExperience: string | null;

  @ApiProperty({ nullable: true, type: Number })
  totalEngagedCommunityMembers3Yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  percentEngagedWomen3Yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  percentEngagedMen3Yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  percentEngagedUnder353Yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  percentEngagedOver353Yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  percentEngagedSmallholder3Yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  totalTreesGrown: number | null;

  @ApiProperty({ nullable: true, type: Number })
  avgTreeSurvivalRate: number | null;

  @ApiProperty({ nullable: true, type: String })
  treeMaintenanceAftercareApproach: string | null;

  @ApiProperty({ nullable: true, type: String })
  restoredAreasDescription: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  restorationTypesImplemented: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  historicMonitoringGeojson: string | null;

  @ApiProperty({ nullable: true, type: String })
  monitoringEvaluationExperience: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingHistory: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  engagementFarmers: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  engagementWomen: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  engagementYouth: string[] | null;

  @ApiProperty()
  currency: string;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  states: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  district: string | null;

  @ApiProperty({ nullable: true, type: String })
  accountNumber1: string | null;

  @ApiProperty({ nullable: true, type: String })
  accountNumber2: string | null;

  @ApiProperty({ nullable: true, type: String })
  loanStatusAmount: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  loanStatusTypes: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  approachOfMarginalizedCommunities: string | null;

  @ApiProperty({ nullable: true, type: String })
  communityEngagementNumbersMarginalized: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landSystems: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  fundUtilisation: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  detailedInterventionTypes: string[] | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3yr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3yrWomen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3yrMen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3yrYouth: number | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3yrNonYouth: number | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3yrSmallholder: number | null;

  @ApiProperty({ nullable: true, type: Number })
  communityMembersEngaged3YrBackwardClass: number | null;

  @ApiProperty({ nullable: true, type: String })
  engagementNonYouth: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  treeRestorationPractices: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  businessModel: string | null;

  @ApiProperty({ nullable: true, type: String })
  subtype: string | null;

  @ApiProperty({ nullable: true, type: String })
  fieldStaffSkills: string | null;

  @ApiProperty({ nullable: true, type: String, enum: ["yes", "no"] })
  fpcCompany: string | null;

  @ApiProperty({ nullable: true, type: Number })
  numOfMarginalisedEmployees: number | null;

  @ApiProperty({ nullable: true, type: String })
  benefactorsFpcCompany: string | null;

  @ApiProperty({ nullable: true, type: String })
  boardRemunerationFpcCompany: string | null;

  @ApiProperty({ nullable: true, type: String })
  boardEngagementFpcCompany: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  biodiversityFocus: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  globalPlanningFrameworks: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  pastGovCollaboration: string | null;

  @ApiProperty({ nullable: true, type: String })
  engagementLandless: string | null;

  @ApiProperty({ nullable: true, type: String })
  socioeconomicImpact: string | null;

  @ApiProperty({ nullable: true, type: String })
  environmentalImpact: string | null;

  @ApiProperty({ nullable: true, type: String })
  growthStage: string | null;

  @ApiProperty({ nullable: true, type: Number })
  totalEmployees: number | null;

  @ApiProperty({ nullable: true, type: String })
  additionalComments: string | null;

  @ApiProperty({ nullable: true, type: String })
  consortium: string | null;

  @ApiProperty({ nullable: true, type: String })
  femaleYouthLeadershipExample: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  level0PastRestoration: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  level1PastRestoration: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  level2PastRestoration: string[] | null;

  @ApiProperty({ nullable: true, type: Number })
  treesNaturallyRegeneratedTotal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  treesNaturallyRegenerated3Year: number | null;

  @ApiProperty({ nullable: true, type: String })
  externalTechnicalAssistance: string | null;

  @ApiProperty({ nullable: true, type: String })
  barriersToFunding: string | null;

  @ApiProperty({ nullable: true, type: String })
  capacityBuildingSupportNeeded: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  associationsCooperatives: boolean | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  territoriesOfOperation: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  decisionMakingStructureDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  decisionMakingStructureIndividualsInvolved: string | null;

  @ApiProperty({ nullable: true, type: Number })
  averageWorkerIncome: number | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  anrPracticesPast: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  anrMonitoringApproaches: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  anrMonitoringApproachesDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  anrCommunicationFunders: string | null;

  @ApiProperty({ nullable: true, type: String })
  bioeconomyProducts: string | null;

  @ApiProperty({ nullable: true, type: String })
  bioeconomyTraditionalKnowledge: string | null;

  @ApiProperty({ nullable: true, type: String })
  bioeconomyProductProcessing: string | null;

  @ApiProperty({ nullable: true, type: String })
  bioeconomyBuyers: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
