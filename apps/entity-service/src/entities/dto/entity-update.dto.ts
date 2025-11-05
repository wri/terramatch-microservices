import { ApiProperty } from "@nestjs/swagger";
import {
  ENTITY_STATUSES,
  EntityStatus,
  REPORT_STATUSES,
  ReportStatus
} from "@terramatch-microservices/database/constants/status";
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
  @IsIn(ENTITY_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given site",
    required: false,
    enum: ENTITY_STATUSES
  })
  status?: EntityStatus;
}

export class ReportUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given report",
    required: false,
    enum: REPORT_STATUSES
  })
  status?: ReportStatus;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the nothingToReport flag.", required: false })
  nothingToReport?: boolean;
}

export class ProjectUpdateData extends JsonApiDataDto({ type: "projects" }, ProjectUpdateAttributes) {}
export class SiteUpdateData extends JsonApiDataDto({ type: "sites" }, SiteUpdateAttributes) {}
export class NurseryUpdateData extends JsonApiDataDto({ type: "nurseries" }, EntityUpdateAttributes) {}
export class ProjectReportUpdateData extends JsonApiDataDto({ type: "projectReports" }, ReportUpdateAttributes) {}
export class SiteReportUpdateData extends JsonApiDataDto({ type: "siteReports" }, ReportUpdateAttributes) {}
export class NurseryReportUpdateData extends JsonApiDataDto({ type: "nurseryReports" }, ReportUpdateAttributes) {}
export class FinancialReportUpdateData extends JsonApiDataDto({ type: "financialReports" }, ReportUpdateAttributes) {}
export class DisturbanceReportUpdateData extends JsonApiDataDto(
  { type: "disturbanceReports" },
  ReportUpdateAttributes
) {}

export type EntityUpdateData =
  | ProjectUpdateAttributes
  | SiteUpdateAttributes
  | ReportUpdateAttributes
  | EntityUpdateAttributes;
export class EntityUpdateBody extends JsonApiMultiBodyDto([
  ProjectUpdateData,
  SiteUpdateData,
  NurseryUpdateData,
  ProjectReportUpdateData,
  SiteReportUpdateData,
  NurseryReportUpdateData,
  FinancialReportUpdateData,
  DisturbanceReportUpdateData
] as const) {}
