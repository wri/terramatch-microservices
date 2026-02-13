import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { ORGANISATION_STATUSES, OrganisationStatus } from "@terramatch-microservices/database/constants/status";

const ORGANISATION_TYPES = ["non-profit-organization", "for-profit-organization"] as const;
type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export class OrganisationUpdateAttributes {
  @IsOptional()
  @IsEnum(ORGANISATION_STATUSES)
  @ApiProperty({ enum: ORGANISATION_STATUSES, required: false })
  status?: OrganisationStatus;

  @IsOptional()
  @IsEnum(ORGANISATION_TYPES)
  @ApiProperty({ enum: ORGANISATION_TYPES, required: false })
  type?: OrganisationType | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  subtype?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  private?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the isTest flag.", required: false })
  isTest?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  name?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  hqStreet1?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  hqStreet2?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  hqCity?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  hqState?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  hqZipcode?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @ApiProperty({ required: false, nullable: true })
  hqCountry?: string | null;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, nullable: true, type: Date })
  foundingDate?: Date | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  countries?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  languages?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  treeCareApproach?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(150)
  @ApiProperty({ required: false, nullable: true, type: Number })
  relevantExperienceYears?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  treesGrown3Year?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  treesGrownTotal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  haRestored3Year?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  haRestoredTotal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @ApiProperty({ required: false, nullable: true, type: Number })
  finStartMonth?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  webUrl?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  facebookUrl?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  instagramUrl?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  linkedinUrl?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  twitterUrl?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  leadershipTeamTxt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  engagementFarmers?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  engagementWomen?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  engagementYouth?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  states?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  district?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  accountNumber1?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  accountNumber2?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  loanStatusAmount?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  loanStatusTypes?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  approachOfMarginalizedCommunities?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  communityEngagementNumbersMarginalized?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  landSystems?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  fundUtilisation?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  detailedInterventionTypes?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  treeMaintenanceAftercareApproach?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  restoredAreasDescription?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  restorationTypesImplemented?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  historicMonitoringGeojson?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  monitoringEvaluationExperience?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  fundingHistory?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  totalEngagedCommunityMembers3Yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  percentEngagedWomen3Yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  percentEngagedMen3Yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  percentEngagedUnder353Yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  percentEngagedOver353Yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  percentEngagedSmallholder3Yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  totalTreesGrown?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  avgTreeSurvivalRate?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  ftPermanentEmployees?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  ptPermanentEmployees?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  tempEmployees?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  femaleEmployees?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  maleEmployees?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  youngEmployees?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  over35Employees?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  additionalFundingDetails?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  communityExperience?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  businessModel?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  fieldStaffSkills?: string | null;

  @IsOptional()
  @IsEnum(["yes", "no"])
  @ApiProperty({ required: false, nullable: true, enum: ["yes", "no"] })
  fpcCompany?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  numOfMarginalisedEmployees?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  benefactorsFpcCompany?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  boardRemunerationFpcCompany?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  boardEngagementFpcCompany?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  biodiversityFocus?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  globalPlanningFrameworks?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  pastGovCollaboration?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  engagementLandless?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  socioeconomicImpact?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  environmentalImpact?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  growthStage?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  totalEmployees?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  additionalComments?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  consortium?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  femaleYouthLeadershipExample?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  level0PastRestoration?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(3, undefined, { each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  level1PastRestoration?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  level2PastRestoration?: string[] | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  treesNaturallyRegeneratedTotal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  treesNaturallyRegenerated3Year?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  externalTechnicalAssistance?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  barriersToFunding?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  capacityBuildingSupportNeeded?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, nullable: true })
  associationsCooperatives?: boolean | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  territoriesOfOperation?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  decisionMakingStructureDescription?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  decisionMakingStructureIndividualsInvolved?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  averageWorkerIncome?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  anrPracticesPast?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  anrMonitoringApproaches?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  anrMonitoringApproachesDescription?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  anrCommunicationFunders?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  bioeconomyProducts?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  bioeconomyTraditionalKnowledge?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  bioeconomyProductProcessing?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  bioeconomyBuyers?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3yr?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3yrWomen?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3yrMen?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3yrYouth?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3yrNonYouth?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3yrSmallholder?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  communityMembersEngaged3YrBackwardClass?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  engagementNonYouth?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  treeRestorationPractices?: string[] | null;
}

export class OrganisationUpdateBody extends JsonApiBodyDto(
  class OrganisationUpdateData extends JsonApiDataDto({ type: "organisations" }, OrganisationUpdateAttributes) {}
) {}
