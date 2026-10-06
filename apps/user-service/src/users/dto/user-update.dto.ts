import { IsArray, IsEnum, IsIn, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { FRAMEWORK_KEYS } from "@terramatch-microservices/database/constants/framework";
import { ROLE_SLUGS } from "@terramatch-microservices/database/constants/permissions";

export class UserUpdateAttributes {
  @ApiProperty({ description: "Organisation UUID", nullable: true, required: false, format: "uuid", type: String })
  organisationUuid?: string | null;

  @ApiProperty({ description: "First name", nullable: true, required: false, type: String })
  firstName?: string | null;

  @ApiProperty({ description: "Last name", nullable: true, required: false, type: String })
  lastName?: string | null;

  @ApiProperty({ description: "Email address", nullable: true, required: false, format: "email", type: String })
  emailAddress?: string | null;

  @ApiProperty({ description: "Password", nullable: true, required: false, type: String })
  password?: string | null;

  @ApiProperty({ description: "Job role", nullable: true, required: false, type: String })
  jobRole?: string | null;

  @ApiProperty({ description: "Phone number", nullable: true, required: false, type: String })
  phoneNumber?: string | null;

  @ApiProperty({ description: "Country", nullable: true, required: false, type: String })
  country?: string | null;

  @ApiProperty({ description: "Program", nullable: true, required: false, type: String })
  program?: string | null;

  @IsEnum(VALID_LOCALES)
  @ApiProperty({
    description: "New default locale for the given user",
    nullable: true,
    required: false,
    enum: VALID_LOCALES
  })
  @IsOptional()
  locale?: ValidLocale | null;

  @ApiProperty({
    description: "Replaces the user's full set of roles",
    required: false,
    isArray: true,
    enum: ROLE_SLUGS
  })
  @IsOptional()
  @IsArray()
  @IsIn(ROLE_SLUGS, { each: true })
  roles?: string[];

  @ApiProperty({ required: false, nullable: true, isArray: true, enum: FRAMEWORK_KEYS })
  @IsOptional()
  @IsArray()
  @IsIn(FRAMEWORK_KEYS, { each: true })
  directFrameworks?: string[] | null;
}

export class UserUpdateBody extends JsonApiBodyDto(
  class UserData extends JsonApiDataDto({ type: "users" }, UserUpdateAttributes) {}
) {}
