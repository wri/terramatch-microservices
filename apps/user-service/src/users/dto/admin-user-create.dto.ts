import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from "class-validator";
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

  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  directFrameworks: string[];
}

export class AdminUserCreateBody extends JsonApiBodyDto(
  class AdminUserCreateData extends CreateDataDto("users", AdminUserCreateAttributes) {}
) {}
