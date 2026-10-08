import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UserAssociationCreateAttributes {
  @IsEmail()
  @ApiProperty({ description: "Email address to associate with the project.", required: true })
  emailAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: "First name of the invited user.", required: false, maxLength: 255 })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: "Last name of the invited user.", required: false, maxLength: 255 })
  lastName?: string;

  @ApiProperty({ description: "Flag to createa a manager or not", required: true })
  @IsBoolean()
  isManager: boolean;
}

export class UserAssociationCreateData extends CreateDataDto("associatedUsers", UserAssociationCreateAttributes) {}

export class UserAssociationCreateBody extends JsonApiBodyDto(UserAssociationCreateData) {}
