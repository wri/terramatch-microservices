import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class DelayedJobAttributes {
  @IsBoolean()
  @ApiProperty({ description: "Value to set for isAcknowledged", example: true })
  isAcknowledged: boolean;
}

export class DelayedJobData {
  @Equals("delayedJobs")
  @ApiProperty({ enum: ["delayedJobs"], description: "Type of the resource", example: "delayedJobs" })
  type: "delayedJobs";

  @IsUUID()
  @ApiProperty({ format: "uuid", description: "UUID of the job", example: "550e8400-e29b-41d4-a716-446655440000" })
  id: string;

  @ValidateNested()
  @Type(() => DelayedJobAttributes)
  @ApiProperty({ description: "Attributes to update for the job", type: DelayedJobAttributes })
  attributes: DelayedJobAttributes;
}

export class DelayedJobBulkUpdateBodyDto extends JsonApiBulkBodyDto(DelayedJobData, {
  description: "List of jobs to update isAcknowledged",
  minSize: 1
}) {}
