import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export const TASK_SIDELOADS = ["projectReports", "siteReports", "nurseryReports", "srpReports"] as const;
export type TaskSideload = (typeof TASK_SIDELOADS)[number];

export class TaskQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  frameworkKey?: string;

  @ApiProperty({ required: false, description: "Only one of projectUuid, siteUuid and nurseryUuid may be provided" })
  @IsOptional()
  projectUuid?: string;

  @ApiProperty({ required: false, description: "Only one of projectUuid, siteUuid and nurseryUuid may be provided" })
  @IsOptional()
  siteUuid?: string;

  @ApiProperty({ required: false, description: "Only one of projectUuid, siteUuid and nurseryUuid may be provided" })
  @IsOptional()
  nurseryUuid?: string;

  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    enum: TASK_SIDELOADS,
    description: "sideloads to include"
  })
  @IsOptional()
  sideloads?: TaskSideload[];
}
