import { JsonApiAttributes } from '@terramatch-microservices/common/dto/json-api-attributes';
import { JsonApiDto } from '@terramatch-microservices/common/decorators';
import { ApiProperty } from '@nestjs/swagger';

const STATUSES = ['pending', 'failed', 'succeeded']
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: 'jobs' })
export class JobDto extends JsonApiAttributes<JobDto> {
  @ApiProperty({
    description: 'The current status of the job. If the status is not pending, either the payload or error will be provided.',
    enum: STATUSES
  })
  status: Status;
}
