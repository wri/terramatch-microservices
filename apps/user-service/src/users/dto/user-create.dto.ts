import { ArrayMinSize, IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export const SIGN_UP_ROLES = ["project-developer", "funder", "government"] as const;

export class UserCreateBaseAttributes {
  @IsNotEmpty()
  @ApiProperty()
  firstName: string;

  @IsNotEmpty()
  @ApiProperty()
  lastName: string;

  @IsEmail()
  @ApiProperty()
  emailAddress: string;

  @IsOptional()
  @ApiProperty({ nullable: true })
  phoneNumber?: string;

  @IsOptional()
  @ApiProperty({ nullable: true })
  jobRole?: string;

  @IsOptional()
  @ApiProperty({ nullable: true })
  country?: string;

  @IsOptional()
  @ApiProperty({ nullable: true })
  program?: string;
}

export class UserCreateBaseBody extends JsonApiBodyDto(
  class UserCreateBaseData extends CreateDataDto("users", UserCreateBaseAttributes) {}
) {}

export class UserCreateAttributes extends UserCreateBaseAttributes {
  @IsNotEmpty()
  @ApiProperty()
  password: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SIGN_UP_ROLES, { each: true })
  @ApiProperty({ isArray: true, enum: SIGN_UP_ROLES })
  roles: string[];

  @IsNotEmpty()
  @ApiProperty()
  callbackUrl: string;

  @IsOptional()
  @ApiProperty({ description: "Token for invite-based signup completion", required: false })
  token?: string;
}

export class UserCreateBody extends JsonApiBodyDto(
  class UserCreateData extends CreateDataDto("users", UserCreateAttributes) {}
) {}
