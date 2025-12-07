import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class SingleSubmissionDto {
  @IsUUID()
  @ApiProperty({ description: "UUID for form submission to retrieve" })
  uuid: string;
}
