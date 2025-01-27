import { IsDate } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateAllQueryDto {
  @IsDate()
  @ApiProperty({ description: "The timestamp from which to look for updated records" })
  updatedSince: Date;
}
