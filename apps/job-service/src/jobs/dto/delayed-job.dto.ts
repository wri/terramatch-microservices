import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

const STATUSES = ["pending", "failed", "succeeded"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "delayedJobs" })
export class DelayedJobDto extends JsonApiAttributes<DelayedJobDto> {
  constructor(job: DelayedJob) {
    const { status, statusCode, payload, processed_content, total_content, proccess_message } = job;
    super({ status, statusCode, payload, processed_content, total_content, proccess_message });
  }

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
  total_content: number | null;

  @ApiProperty({
    description: 'If the job is in progress, this is the total content processed',
    nullable: true
  })
  processed_content: number | null;

  @ApiProperty({
    description: 'If the job is in progress, this is the proccess message',
    nullable: true
  })
  proccess_message: string | null
}
