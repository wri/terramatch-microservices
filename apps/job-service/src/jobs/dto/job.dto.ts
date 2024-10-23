import { JsonApiAttributes } from '@terramatch-microservices/common/dto/json-api-attributes';
import { JsonApiDto } from '@terramatch-microservices/common/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { DelayedJob } from '@terramatch-microservices/database/entities';

const STATUSES = ['pending', 'failed', 'succeeded']
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: 'jobs' })
export class JobDto extends JsonApiAttributes<JobDto> {
  constructor(job: DelayedJob) {
    super({
      status: job.status,
      statusCode: job.statusCode,
      payload: job.payload,
    })
  }

  @ApiProperty({
    description: 'The current status of the job. If the status is not pending, either the payload or error will be provided.',
    enum: STATUSES
  })
  status: Status;

  @ApiProperty({
    description: 'If the job is out of pending state, this is the HTTP status code for the completed process',
    nullable: true
  })
  statusCode: number | null;

  @ApiProperty({
    description: 'If the job is out of pending state, this is the JSON payload for the completed process',
    nullable: true
  })
  payload: string | null;
}
