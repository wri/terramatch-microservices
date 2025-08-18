import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_STATUSES, REPORT_STATUSES, SITE_STATUSES } from "@terramatch-microservices/database/constants/status";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { JsonApiDataDto, JsonApiMultiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { Type } from "class-transformer";

export class EntityUpdateAttributes {
  @IsOptional()
  @IsIn(ENTITY_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    required: false,
    enum: ENTITY_STATUSES
  })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Specific feedback for the PD", required: false, type: String })
  feedback?: string;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    isArray: true,
    type: String,
    description: "The fields in the entity form that need attention from the PD",
    required: false
  })
  feedbackFields?: string[];
}

export class ProjectUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the isTest flag.", required: false })
  isTest?: boolean;
}

export class SiteUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(SITE_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given site",
    required: false,
    enum: SITE_STATUSES
  })
  status?: string;
}

export class ReportUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given report",
    required: false,
    enum: REPORT_STATUSES
  })
  status?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the nothingToReport flag.", required: false })
  nothingToReport?: boolean;
}

export class FinancialReportUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Update the title of the financial report", required: false })
  title?: string;

  @IsOptional()
  @ApiProperty({ description: "Update the year of the report", required: false, type: Number })
  yearOfReport?: number;

  @IsOptional()
  @ApiProperty({ description: "Update the due date", required: false, type: Date })
  dueAt?: Date;

  @IsOptional()
  @ApiProperty({ description: "Update the submitted date", required: false, type: Date })
  submittedAt?: Date;

  @IsOptional()
  @ApiProperty({ description: "Update the approved date", required: false, type: Date })
  approvedAt?: Date;

  @IsOptional()
  @ApiProperty({ description: "Update the completion percentage", required: false, type: Number })
  completion?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Update the feedback", required: false })
  feedback?: string;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({ description: "Update the feedback fields", required: false, isArray: true, type: String })
  feedbackFields?: string[];

  @IsOptional()
  @ApiProperty({ description: "Update the answers", required: false })
  answers?: any;

  @IsOptional()
  @ApiProperty({ description: "Update the financial start month", required: false, type: Number })
  finStartMonth?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Update the currency", required: false })
  currency?: string;
}

export class ProjectUpdateData extends JsonApiDataDto({ type: "projects" }, ProjectUpdateAttributes) {}
export class SiteUpdateData extends JsonApiDataDto({ type: "sites" }, SiteUpdateAttributes) {}
export class NurseryUpdateData extends JsonApiDataDto({ type: "nurseries" }, EntityUpdateAttributes) {}
export class ProjectReportUpdateData extends JsonApiDataDto({ type: "projectReports" }, ReportUpdateAttributes) {}
export class SiteReportUpdateData extends JsonApiDataDto({ type: "siteReports" }, ReportUpdateAttributes) {}
export class NurseryReportUpdateData extends JsonApiDataDto({ type: "nurseryReports" }, ReportUpdateAttributes) {}
export class FinancialReportUpdateData extends JsonApiDataDto(
  { type: "financialReports" },
  FinancialReportUpdateAttributes
) {}

export type EntityUpdateData =
  | ProjectUpdateAttributes
  | SiteUpdateAttributes
  | ReportUpdateAttributes
  | FinancialReportUpdateAttributes
  | EntityUpdateAttributes;
export class EntityUpdateBody extends JsonApiMultiBodyDto([
  ProjectUpdateData,
  SiteUpdateData,
  NurseryUpdateData,
  ProjectReportUpdateData,
  SiteReportUpdateData,
  NurseryReportUpdateData,
  FinancialReportUpdateData
] as const) {}
