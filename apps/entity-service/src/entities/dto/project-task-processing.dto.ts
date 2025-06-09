import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { Type } from "class-transformer";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

export enum ReportType {
  SITE_REPORT = "siteReport",
  NURSERY_REPORT = "nurseryReport"
}

@JsonApiDto({ type: "reports" })
export class ReportDto {
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
  taskUuid: string;

  @ApiProperty({ description: "Whether the report has nothing to report" })
  nothingToReport: boolean;
}

@JsonApiDto({ type: "processProjectTasks" })
export class ProjectTaskProcessingResponseDto {
  constructor(data: ProjectTaskProcessingResponseDto) {
    populateDto<ProjectTaskProcessingResponseDto>(this, data);
  }

  @IsUUID()
  @ApiProperty({ description: "UUID of the project" })
  projectUuid: string;

  @IsString()
  @ApiProperty({ description: "Name of the project" })
  projectName: string;

  @IsArray()
  @Type(() => ReportDto)
  @ApiProperty({ type: [ReportDto], description: "Array of reports associated with the project's tasks" })
  reports: ReportDto[];
}

@JsonApiDto({ type: "approveReports" })
export class ApproveReportsDto {
  @IsArray()
  @IsUUID("4", { each: true })
  @ApiProperty({
    type: [String],
    description: "Array of report UUIDs to be approved",
    example: ["123e4567-e89b-12d3-a456-426614174000"]
  })
  reportUuids: string[];

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: "Optional feedback for the report approval",
    example: "Reports look good, approved with no changes needed"
  })
  feedback?: string;

  @IsString()
  @ApiProperty({
    required: true,
    description: "UUID of the project these reports belong to"
  })
  uuid: string;
}

@JsonApiDto({ type: "approveReportsResponse" })
export class ApproveReportsResponseDto {
  constructor(data: ApproveReportsResponseDto) {
    populateDto<ApproveReportsResponseDto>(this, data);
  }

  @ApiProperty({
    description: "Number of reports that were approved",
    example: 5
  })
  approvedCount: number;

  @ApiProperty({
    description: "Success message",
    example: "Successfully approved 5 reports"
  })
  message: string;
}
