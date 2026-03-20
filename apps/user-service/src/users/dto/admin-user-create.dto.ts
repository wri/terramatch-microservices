import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserCreateBaseAttributes } from "./user-create.dto";

export class AdminUserCreateAttributes extends UserCreateBaseAttributes {
  @IsNotEmpty()
  @ApiProperty()
  role: string;

  @IsNotEmpty()
  @ApiProperty()
  organisationUuid: string;
}

export class AdminUserCreateBody extends JsonApiBodyDto(
  class AdminUserCreateData extends CreateDataDto("users", AdminUserCreateAttributes) {}
) {}
