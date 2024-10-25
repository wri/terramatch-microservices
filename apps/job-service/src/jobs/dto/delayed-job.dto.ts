import { JsonApiAttributes } from '@terramatch-microservices/common/dto/json-api-attributes';
import { JsonApiDto } from '@terramatch-microservices/common/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { DelayedJob } from '@terramatch-microservices/database/entities';
import { JSON } from 'sequelize';

const STATUSES = ['pending', 'failed', 'succeeded']
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: 'delayedJobs' })
export class DelayedJobDto extends JsonApiAttributes<DelayedJobDto> {
  constructor(job: DelayedJob) {
    const { status, statusCode, payload } = job;
    super({ status, statusCode, payload });
  }

  @ApiProperty({
    description: 'The current status of the job. If the status is not pending, the payload and statusCode will be provided.',
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
  payload: object | null;
}
