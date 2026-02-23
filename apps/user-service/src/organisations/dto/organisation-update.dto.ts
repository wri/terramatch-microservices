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
  @IsNumber()
  @Min(1)
  @Max(12)
  @ApiProperty({ required: false, nullable: true, type: Number })
  finStartMonth?: number | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  additionalFundingDetails?: string | null;

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
  @ApiProperty({ required: false, nullable: true })
  communityExperience?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  totalEngagedCommunityMembers3Yr?: number | null;

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
  haRestoredTotal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  haRestored3Year?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  treesGrownTotal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false, nullable: true, type: Number })
  treesGrown3Year?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({ required: false, nullable: true, type: Number })
  avgTreeSurvivalRate?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, nullable: true, isArray: true, type: String })
  restorationTypesImplemented?: string[] | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  treeMaintenanceAftercareApproach?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  restoredAreasDescription?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  monitoringEvaluationExperience?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  historicMonitoringGeojson?: string | null;

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
}

export class OrganisationUpdateBody extends JsonApiBodyDto(
  class OrganisationUpdateData extends JsonApiDataDto({ type: "organisations" }, OrganisationUpdateAttributes) {}
) {}
