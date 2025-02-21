import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class VerificationUserRequest {
  @IsNotEmpty()
  @ApiProperty()
  token: string;
}
