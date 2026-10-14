import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { ArrayMinSize, IsArray, IsIn, IsOptional } from "class-validator";
import { FRAMEWORK_KEYS } from "@terramatch-microservices/database/constants/framework";
import { ROLE_SLUGS } from "@terramatch-microservices/database/constants/permissions";
import { ApiProperty } from "@nestjs/swagger";
import { UserCreateBaseAttributes } from "./user-create.dto";

export class AdminUserCreateAttributes extends UserCreateBaseAttributes {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ROLE_SLUGS, { each: true })
  @ApiProperty({ isArray: true, enum: ROLE_SLUGS })
  roles: string[];

  @IsOptional()
  @ApiProperty({ nullable: true, type: String })
  organisationUuid?: string | null;

  @ApiProperty({ isArray: true, enum: FRAMEWORK_KEYS })
  @IsArray()
  @IsIn(FRAMEWORK_KEYS, { each: true })
  directFrameworks: string[];
}

export class AdminUserCreateBody extends JsonApiBodyDto(
  class AdminUserCreateData extends CreateDataDto("users", AdminUserCreateAttributes) {}
) {}
