import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class OrganisationInviteReminderRequestDto {
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "Optional callback URL base for the signup link in the reminder email.",
    required: false,
    type: String
  })
  callbackUrl?: string;
}
