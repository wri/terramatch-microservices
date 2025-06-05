import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsEnum, IsString, IsUUID } from "class-validator";
import { Type } from "class-transformer";

export enum ReportType {
  SITE_REPORT = "siteReport",
  NURSERY_REPORT = "nurseryReport"
}

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
}

export class ProjectTaskProcessingResponseDto {
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

export class ApproveReportsDto {
  @IsArray()
  @IsUUID("4", { each: true })
  @ApiProperty({
    type: [String],
    description: "Array of report UUIDs to be approved",
    example: ["123e4567-e89b-12d3-a456-426614174000"]
  })
  reportUuids: string[];
}

export class ApproveReportsResponseDto {
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
