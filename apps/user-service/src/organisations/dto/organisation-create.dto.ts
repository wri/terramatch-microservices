import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsArray, IsIn, IsOptional, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

const ORGANISATION_TYPES = ["non-profit-organization", "for-profit-organization"] as const;
type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export class OrganisationCreateAttributes {
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

  @ApiProperty({ isArray: true, type: String, required: false })
  @IsOptional()
  @IsArray()
  @Length(3, 3, { each: true })
  countries?: string[];

  @IsOptional()
  @ApiProperty({ required: false, default: "USD" })
  currency?: string;

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
}

export class OrganisationCreateBody extends JsonApiBodyDto(
  class OrganisationCreateData extends CreateDataDto("organisations", OrganisationCreateAttributes) {}
) {}
