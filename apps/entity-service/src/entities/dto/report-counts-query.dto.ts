import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { REPORT_STATUSES, ReportStatus } from "@terramatch-microservices/database/constants/status";
import { ReportType } from "@terramatch-microservices/database/constants/entities";

export const REPORT_COUNT_TYPES = [
  "disturbanceReports",
  "nurseryReports",
  "projectReports",
  "siteReports",
  "srpReports"
] as const satisfies readonly ReportType[];
export type ReportCountType = (typeof REPORT_COUNT_TYPES)[number];

export class ReportCountsQueryDto {
  @ApiProperty({ required: false, type: String, format: "date", description: "Inclusive lower bound for due date" })
  @IsOptional()
  @IsDate()
  dueDateFrom?: Date;

  @ApiProperty({ required: false, type: String, format: "date", description: "Inclusive upper bound for due date" })
  @IsOptional()
  @IsDate()
  dueDateTo?: Date;

  @ApiProperty({ required: false, minimum: 1, maximum: 12, description: "Due month (1-12)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  dueMonth?: number;

  @ApiProperty({ required: false, description: "Due year" })
  @IsOptional()
  @IsInt()
  dueYear?: number;

  @ApiProperty({
    required: false,
    isArray: true,
    enum: REPORT_COUNT_TYPES,
    description: "Report types to include. If omitted, all report types are included."
  })
  @IsOptional()
  @IsArray()
  @IsIn(REPORT_COUNT_TYPES, { each: true })
  reportTypes?: ReportCountType[];

  @ApiProperty({ required: false, isArray: true, enum: REPORT_STATUSES })
  @IsOptional()
  @IsArray()
  @IsIn(REPORT_STATUSES, { each: true })
  statuses?: ReportStatus[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectUuid?: string;
}
