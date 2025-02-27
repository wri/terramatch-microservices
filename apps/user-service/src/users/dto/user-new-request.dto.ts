import { IsEmail, IsIn, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UserNewRequest {
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

  @IsNotEmpty()
  @ApiProperty()
  country: string;

  @IsNotEmpty()
  @ApiProperty()
  program: string;

  @IsNotEmpty()
  @ApiProperty()
  callbackUrl: string;
}
