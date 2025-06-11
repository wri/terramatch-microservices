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
    nullable: true,
    enum: ENTITY_STATUSES
  })
  status?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Specific feedback for the PD", nullable: true, type: String })
  feedback?: string | null;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    isArray: true,
    type: String,
    description: "The fields in the entity form that need attention from the PD",
    nullable: true
  })
  feedbackFields?: string[] | null;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    description: "Virtual property to update the status of specific site reports by their UUIDs",
    isArray: true,
    type: String,
    nullable: true
  })
  siteReportNothingToReportStatus?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    description: "Virtual property to update the status of specific nursery reports by their UUIDs",
    isArray: true,
    type: String,
    nullable: true
  })
  nurseryReportNothingToReportStatus?: string[];
}

export class ProjectUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the isTest flag.", nullable: true })
  isTest?: boolean;
}

export class SiteUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(SITE_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given site",
    nullable: true,
    enum: SITE_STATUSES
  })
  status?: string | null;
}

export class ReportUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given report",
    nullable: true,
    enum: REPORT_STATUSES
  })
  status?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the nothingToReport flag.", nullable: true })
  nothingToReport?: boolean;
}

export class ProjectUpdateData extends JsonApiDataDto({ type: "projects" }, ProjectUpdateAttributes) {}
export class SiteUpdateData extends JsonApiDataDto({ type: "sites" }, SiteUpdateAttributes) {}
export class NurseryUpdateData extends JsonApiDataDto({ type: "nurseries" }, EntityUpdateAttributes) {}
export class ProjectReportUpdateData extends JsonApiDataDto({ type: "projectReports" }, ReportUpdateAttributes) {}
export class SiteReportUpdateData extends JsonApiDataDto({ type: "siteReports" }, ReportUpdateAttributes) {}
export class NurseryReportUpdateData extends JsonApiDataDto({ type: "nurseryReports" }, ReportUpdateAttributes) {}

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
  NurseryReportUpdateData
] as const) {}
