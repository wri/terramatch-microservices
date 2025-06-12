import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsEnum, IsString, IsUUID } from "class-validator";
import { Type } from "class-transformer";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { SiteReportLightDto } from "./site-report.dto";
import { NurseryReportLightDto } from "./nursery-report.dto";

export enum ReportType {
  SITE_REPORT = "siteReport",
  NURSERY_REPORT = "nurseryReport"
}

@JsonApiDto({ type: "entityreports" })
export class ReportsBulkApproval {
  constructor(data: ReportsBulkApproval) {
    populateDto<ReportsBulkApproval>(this, data);
  }

  @IsUUID()
  @ApiProperty({ description: "Unique identifier of the report" })
  uuid: string;

  @IsString()
  @ApiProperty({ description: "Name of the report or related entity" })
  name: string;

  @IsEnum(ReportType)
  @ApiProperty({ enum: ReportType, description: "Type of the report" })
  type: ReportType;

  @IsDate()
  @Type(() => Date)
  @ApiProperty({ description: "When the report was submitted" })
  submittedAt: Date;

  @IsUUID()
  @ApiProperty({ description: "UUID of the task this report belongs to" })
  status: string;

  @ApiProperty({ description: "Whether the report has nothing to report" })
  nothingToReport: boolean;
}

@JsonApiDto({ type: "processBulkApproval" })
export class processBulkApprovalDto {
  constructor(data: processBulkApprovalDto) {
    populateDto<processBulkApprovalDto>(this, data);
  }

  @IsUUID()
  @ApiProperty({ description: "UUID of the project" })
  projectUuid: string;

  @IsArray()
  @Type(() => ReportsBulkApproval)
  @ApiProperty({ type: [ReportsBulkApproval], description: "Array of reports associated with the project's tasks" })
  reportsBulkApproval: ReportsBulkApproval[];
}
