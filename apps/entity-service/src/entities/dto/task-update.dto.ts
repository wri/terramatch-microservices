import { IsIn, IsOptional, IsArray, IsString } from "class-validator";
import { TASK_STATUSES, TaskStatus } from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { Type } from "class-transformer";

export class TaskUpdateAttributes {
  @IsOptional()
  @IsIn(TASK_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    nullable: true,
    enum: TASK_STATUSES
  })
  status?: TaskStatus | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Specific feedback for the PD", required: false, type: String })
  feedback?: string | null;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    description: "UUIDs of site reports to mark as 'Nothing to report'",
    isArray: true,
    type: String,
    nullable: true
  })
  siteReportNothingToReportUuid?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    description: "UUIDs of nursery reports to mark as 'Nothing to report'",
    isArray: true,
    type: String,
    nullable: true
  })
  nurseryReportNothingToReportUuid?: string[];
}

export class TaskUpdateBody extends JsonApiBodyDto(
  class TaskData extends JsonApiDataDto({ type: "tasks" }, TaskUpdateAttributes) {}
) {}
