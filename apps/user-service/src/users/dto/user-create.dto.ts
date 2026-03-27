import { IsEmail, IsIn, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

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

  @IsNotEmpty()
  @ApiProperty()
  phoneNumber: string;

  @IsNotEmpty()
  @ApiProperty()
  jobRole: string;

  @IsOptional()
  @ApiProperty()
  country: string;

  @IsOptional()
  @ApiProperty()
  program: string;
}

export class UserCreateBaseBody extends JsonApiBodyDto(
  class UserCreateBaseData extends CreateDataDto("users", UserCreateBaseAttributes) {}
) {}

export class UserCreateAttributes extends UserCreateBaseAttributes {
  @IsNotEmpty()
  @ApiProperty()
  password: string;

  @IsNotEmpty()
  @IsIn(["project-developer", "funder", "government"])
  @ApiProperty()
  role: string;

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
