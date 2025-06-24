import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";

export class TotalJobsCreatedQueryDto {
  @ApiProperty({ required: false, isArray: true, description: "project uuid array" })
  @IsOptional()
  @IsArray()
  projectUuid: string[];
}
