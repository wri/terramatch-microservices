import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

const STATUSES = ["pending", "failed", "succeeded"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "delayedJobs" })
export class DelayedJobDto extends JsonApiAttributes<DelayedJobDto> {

  @ApiProperty({
    description:
      "The current status of the job. If the status is not pending, the payload and statusCode will be provided.",
    enum: STATUSES
  })
  status: Status;

  @ApiProperty({
    description: "If the job is out of pending state, this is the HTTP status code for the completed process",
    nullable: true
  })
  statusCode: number | null;

  @ApiProperty({
    description: "If the job is out of pending state, this is the JSON payload for the completed process",
    nullable: true
  })
  payload: object | null;

  @ApiProperty({
    description: 'If the job is in progress, this is the total content to process',
    nullable: true
  })
  totalContent: number | null;

  @ApiProperty({
    description: 'If the job is in progress, this is the total content processed',
    nullable: true
  })
  processedContent: number | null;

  @ApiProperty({
    description: 'If the job is in progress, this is the proccess message',
    nullable: true
  })
  progressMessage: string | null

  @ApiProperty({
    description: 'Indicates whether the jobs have been cleared',
    nullable: true
  })
  isCleared: string | null
}
