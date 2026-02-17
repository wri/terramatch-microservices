import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsEmail } from "class-validator";

export class UserAssociationCreateAttributes {
  @IsEmail()
  @ApiProperty({ description: "Email address to associate with the project.", required: true })
  emailAddress: string;

  @ApiProperty({ description: "Flag to createa a manager or not", required: true })
  @IsBoolean()
  isManager: boolean;
}

export class UserAssociationCreateData extends CreateDataDto("associatedUsers", UserAssociationCreateAttributes) {}

export class UserAssociationCreateBody extends JsonApiBodyDto(UserAssociationCreateData) {}
