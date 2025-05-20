import { ApiProperty } from "@nestjs/swagger";
import { JsonApiAttributes } from "./json-api-attributes";
import { JsonApiDto } from "../decorators";

const STATUSES = ["pending", "failed", "succeeded"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "delayedJobs" })
export class DelayedJobDto extends JsonApiAttributes<DelayedJobDto> {
  @ApiProperty({
    description: "The unique identifier for the delayed job.",
    type: String
  })
  uuid: string;

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
    description: "If the job is in progress, this is the total content to process",
    nullable: true
  })
  totalContent: number | null;

  @ApiProperty({
    description: "If the job is in progress, this is the total content processed",
    nullable: true
  })
  processedContent: number | null;

  @ApiProperty({
    description: "If the job is in progress, this is the progress message",
    nullable: true
  })
  progressMessage: string | null;

  @ApiProperty({
    description: "Indicates whether the jobs have been acknowledged (cleared)",
    nullable: true
  })
  isAcknowledged: boolean | null;

  @ApiProperty({
    description: "The name of the delayedJob",
    nullable: true
  })
  name: string | null;

  @ApiProperty({
    description: "The name of the related entity (e.g., Kerrawarra, New Site, etc).",
    nullable: true,
    required: false
  })
  entityName?: string | null;
}
