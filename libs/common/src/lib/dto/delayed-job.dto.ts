/* istanbul ignore file */
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "../decorators";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

const STATUSES = ["pending", "failed", "succeeded"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "delayedJobs" })
export class DelayedJobDto {
  constructor(job: DelayedJob) {
    const entityType = job.metadata?.entity_type;
    populateDto<DelayedJobDto, DelayedJob>(this, job, {
      entityName: job.metadata?.entity_name,
      entityType:
        entityType != null && ENTITY_TYPES.includes(entityType as EntityType) ? (entityType as EntityType) : null
    });
  }

  @ApiProperty({ description: "The unique identifier for the delayed job." })
  uuid: string;

  @ApiProperty({
    description:
      "The current status of the job. If the status is not pending, the payload and statusCode will be provided.",
    enum: STATUSES
  })
  status: Status;

  @ApiProperty({
    description: "If the job is out of pending state, this is the HTTP status code for the completed process",
    nullable: true,
    type: Number
  })
  statusCode: number | null;

  @ApiProperty({
    description: "If the job is out of pending state, this is the JSON payload for the completed process",
    nullable: true,
    type: Object
  })
  payload: object | null;

  @ApiProperty({
    description: "If the job is in progress, this is the total content to process",
    nullable: true,
    type: Number
  })
  totalContent: number | null;

  @ApiProperty({
    description: "If the job is in progress, this is the total content processed",
    nullable: true,
    type: Number
  })
  processedContent: number | null;

  @ApiProperty({
    description: "If the job is in progress, this is the progress message",
    nullable: true,
    type: String
  })
  progressMessage: string | null;

  @ApiProperty({
    description: "Indicates whether the jobs have been acknowledged (cleared)",
    nullable: true,
    type: Boolean
  })
  isAcknowledged: boolean | null;

  @ApiProperty({
    description: "The name of the delayedJob",
    nullable: true,
    type: String
  })
  name: string | null;

  @ApiProperty({
    description: "The name of the related entity (e.g., Kerrawarra, New Site, etc).",
    nullable: true,
    required: false,
    type: String
  })
  entityName?: string | null;

  @ApiProperty({
    description: "The type of the related entity (e.g., projects, sites, etc).",
    nullable: true,
    required: false,
    enum: ENTITY_TYPES
  })
  entityType?: EntityType | null;
}
