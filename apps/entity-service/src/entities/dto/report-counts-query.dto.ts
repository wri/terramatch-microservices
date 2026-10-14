import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
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

// The due date bounds are kept as the date strings the client sent (instead of being transformed
// to Date) so that the stable request path in the response matches the one the client computes.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportCountsQueryDto {
  @ApiProperty({ required: false, type: String, format: "date", description: "Inclusive lower bound for due date" })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY)
  dueDateFrom?: string;

  @ApiProperty({ required: false, type: String, format: "date", description: "Inclusive upper bound for due date" })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY)
  dueDateTo?: string;

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

  @ApiProperty({
    required: false,
    description:
      "Search term matched against project, site and nursery names. A site or nursery report matches if " +
      "its site / nursery or project name matches; project-level reports match on project name."
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ReportsMetaQueryDto extends IntersectionType(ReportCountsQueryDto, NumberPage) {
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;
}
