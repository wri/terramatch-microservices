import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsArray, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserCreateBaseAttributes } from "./user-create.dto";

export class AdminUserCreateAttributes extends UserCreateBaseAttributes {
  @IsNotEmpty()
  @ApiProperty()
  role: string;

  @IsNotEmpty()
  @ApiProperty()
  organisationUuid: string;

  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  directFrameworks: string[];
}

export class AdminUserCreateBody extends JsonApiBodyDto(
  class AdminUserCreateData extends CreateDataDto("users", AdminUserCreateAttributes) {}
) {}
