import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";

class UserUpdateAttributes {
  @IsEnum(VALID_LOCALES)
  @ApiProperty({ description: "New default locale for the given user", nullable: true, enum: VALID_LOCALES })
  locale?: ValidLocale | null;
}

export class UserUpdateBody extends JsonApiBodyDto(
  class UserData extends JsonApiDataDto({ type: "users" }, UserUpdateAttributes) {}
) {}
