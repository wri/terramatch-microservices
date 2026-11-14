import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsArray, IsEmail, IsIn, IsOptional, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";

const CREATE_ORGANISATION_STATUSES = ["draft", "pending-approval"] as const;
export type CreateOrganisationStatus = (typeof CREATE_ORGANISATION_STATUSES)[number];

/**
 * Organisation profile fields are set through the organisation wizard form
 * (PUT /entities/v3/organisations/:uuid/formData) after the organisation has been created.
 */
export class OrganisationCreateAttributes {
  @IsOptional()
  @IsIn(CREATE_ORGANISATION_STATUSES)
  @ApiProperty({ enum: CREATE_ORGANISATION_STATUSES, required: false, default: "pending-approval" })
  status?: CreateOrganisationStatus;

  @IsOptional()
  @ApiProperty({ required: false })
  fundingProgrammeUuid?: string;

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
