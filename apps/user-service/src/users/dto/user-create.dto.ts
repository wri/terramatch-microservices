import { IsEmail, IsIn, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class UserCreateAttributes {
  @IsNotEmpty()
  @ApiProperty()
  firstName: string;

  @IsNotEmpty()
  @ApiProperty()
  lastName: string;

  @IsNotEmpty()
  @ApiProperty()
  password: string;

  @IsEmail()
  @ApiProperty()
  emailAddress: string;

  @IsNotEmpty()
  @ApiProperty()
  phoneNumber: string;

  @IsNotEmpty()
  @ApiProperty()
  jobRole: string;

  @IsNotEmpty()
  @IsIn(["project-developer", "funder", "government"])
  @ApiProperty()
  role: string;

  @IsOptional()
  @ApiProperty()
  country: string;

  @IsOptional()
  @ApiProperty()
  program: string;

  @IsNotEmpty()
  @ApiProperty()
  callbackUrl: string;
}

export class UserCreateBody extends JsonApiBodyDto(
  class UserCreateData extends CreateDataDto("users", UserCreateAttributes) {}
) {}
