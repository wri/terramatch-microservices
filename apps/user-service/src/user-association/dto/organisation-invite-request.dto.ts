import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class OrganisationInviteRequestDto {
  @IsEmail()
  @MinLength(1)
  @MaxLength(255)
  @ApiProperty({
    description: "Email address to invite to the organisation.",
    required: true,
    maxLength: 255
  })
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

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "Optional callback URL base for the signup link in the email.",
    required: false
  })
  callbackUrl?: string | null;
}
