import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";

export class UserUpdateAttributes {
  @ApiProperty({ description: "Organisation UUID", nullable: true, required: false, format: "uuid" })
  organisationUuid?: string | null;

  @ApiProperty({ description: "First name", nullable: true, required: false })
  firstName?: string | null;

  @ApiProperty({ description: "Last name", nullable: true, required: false })
  lastName?: string | null;

  @ApiProperty({ description: "Email address", nullable: true, required: false, format: "email" })
  emailAddress?: string | null;

  @ApiProperty({ description: "Job role", nullable: true, required: false })
  jobRole?: string | null;

  @ApiProperty({ description: "Phone number", nullable: true, required: false })
  phoneNumber?: string | null;

  @ApiProperty({ description: "Country", nullable: true, required: false })
  country?: string | null;

  @ApiProperty({ description: "Program", nullable: true, required: false })
  program?: string | null;

  @IsEnum(VALID_LOCALES)
  @ApiProperty({ description: "New default locale for the given user", nullable: true, enum: VALID_LOCALES })
  locale?: ValidLocale | null;

  @ApiProperty()
  primaryRole: string;
}

export class UserUpdateBody extends JsonApiBodyDto(
  class UserData extends JsonApiDataDto({ type: "users" }, UserUpdateAttributes) {}
) {}
