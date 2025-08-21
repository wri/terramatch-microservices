import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";

const ORGANISATION_TYPES = ["non-profit-organization", "for-profit-organization"] as const;
type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export class OrganisationCreateAttributes {
  @IsNotEmpty()
  @ApiProperty()
  organisationName: string;

  @IsNotEmpty()
  @IsIn(ORGANISATION_TYPES)
  @ApiProperty({ enum: ORGANISATION_TYPES })
  type: OrganisationType;

  @IsNotEmpty()
  @ApiProperty()
  hqStreet1: string;

  @IsOptional()
  @ApiProperty({ required: false })
  hqStreet2?: string;

  @IsNotEmpty()
  @ApiProperty()
  hqCity: string;

  @IsNotEmpty()
  @ApiProperty()
  hqState: string;

  @IsOptional()
  @ApiProperty({ required: false })
  hqZipcode: string;

  @IsNotEmpty()
  @Length(3, 3)
  @ApiProperty()
  hqCountry: string;

  @IsNotEmpty()
  @ApiProperty()
  phone: string;

  @ApiProperty({
    name: "countries[]",
    isArray: true,
    type: String
  })
  @IsArray()
  @Length(3, 3, { each: true })
  countries: string[];

  @IsNotEmpty()
  @ApiProperty()
  fundingProgrammeUuid: string;

  @IsOptional()
  @ApiProperty({ required: false, default: "USD" })
  currency?: string;

  @ApiProperty({
    name: "level0Proposed[]",
    isArray: true,
    required: false,
    type: String
  })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  level0Proposed?: string[];

  @ApiProperty({
    name: "level1Proposed[]",
    isArray: true,
    required: false,
    type: String
  })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  level1Proposed?: string[];

  @ApiProperty({
    name: "level0PastRestoration[]",
    isArray: true,
    required: false,
    type: String
  })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  level0PastRestoration?: string[];

  @ApiProperty({
    name: "level1PastRestoration[]",
    isArray: true,
    required: false,
    type: String
  })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  level1PastRestoration?: string[];

  @IsNotEmpty()
  @ApiProperty()
  userFirstName: string;

  @IsNotEmpty()
  @ApiProperty()
  userLastName: string;

  @IsEmail()
  @ApiProperty()
  userEmailAddress: string;

  @IsNotEmpty()
  @ApiProperty()
  userRole: string;

  @IsNotEmpty()
  @IsIn(VALID_LOCALES)
  @ApiProperty({ enum: VALID_LOCALES })
  userLocale: ValidLocale;
}

export class OrganisationCreateBody extends JsonApiBodyDto(
  class OrganisationCreateData extends CreateDataDto("organisations", OrganisationCreateAttributes) {}
) {}
