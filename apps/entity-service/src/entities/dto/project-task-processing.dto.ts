import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsEnum, IsString, IsUUID } from "class-validator";
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
