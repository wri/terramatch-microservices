import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ProjectInviteAcceptBodyDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: "Token from the project invite email.",
    required: true
  })
  token: string;
}
