import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsArray, IsEmail, IsIn, IsOptional, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";

const ORGANISATION_TYPES = ["non-profit-organization", "for-profit-organization"] as const;
type OrganisationType = (typeof ORGANISATION_TYPES)[number];
const CREATE_ORGANISATION_STATUSES = ["draft", "pending"] as const;
export type CreateOrganisationStatus = (typeof CREATE_ORGANISATION_STATUSES)[number];

export class OrganisationCreateAttributes {
  @IsOptional()
  @IsIn(CREATE_ORGANISATION_STATUSES)
  @ApiProperty({ enum: CREATE_ORGANISATION_STATUSES, required: false, default: "pending" })
  status?: CreateOrganisationStatus;

  @IsOptional()
  @ApiProperty({ required: false })
  name?: string;

  @IsOptional()
  @IsIn(ORGANISATION_TYPES)
  @ApiProperty({ enum: ORGANISATION_TYPES, required: false })
  type?: OrganisationType;

  @IsOptional()
  @ApiProperty({ required: false })
  hqStreet1?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  hqStreet2?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  hqCity?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  hqState?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  hqZipcode?: string;

  @IsOptional()
  @Length(3, 3)
  @ApiProperty({ required: false })
  hqCountry?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  phone?: string;

  @IsOptional()
  @ApiProperty({ isArray: true, required: false, type: String })
  @IsArray()
  @Length(3, 3, { each: true })
  countries?: string[];

  @IsOptional()
  @ApiProperty({ required: false })
  fundingProgrammeUuid?: string;

  @IsOptional()
  @ApiProperty({ required: false, default: "USD" })
  currency?: string;

  @ApiProperty({ isArray: true, required: false, type: String })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  level0Proposed?: string[];

  @ApiProperty({ isArray: true, required: false, type: String })
  @IsOptional()
  @IsArray()
  @Length(3, undefined, { each: true })
  level1Proposed?: string[];

  @ApiProperty({ isArray: true, required: false, type: String })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  level0PastRestoration?: string[];

  @ApiProperty({ isArray: true, required: false, type: String })
  @IsOptional()
  @IsArray()
  @Length(3, undefined, { each: true })
  level1PastRestoration?: string[];

  @IsOptional()
  @ApiProperty({ required: false })
  userFirstName?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  userLastName?: string;

  @IsOptional()
  @IsEmail()
  @ApiProperty({ required: false })
  userEmailAddress?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  userRole?: string;

  @IsOptional()
  @IsIn(VALID_LOCALES)
  @ApiProperty({ enum: VALID_LOCALES, required: false })
  userLocale?: ValidLocale;
}

export class OrganisationCreateBody extends JsonApiBodyDto(
  class OrganisationCreateData extends CreateDataDto("organisations", OrganisationCreateAttributes) {}
) {}
