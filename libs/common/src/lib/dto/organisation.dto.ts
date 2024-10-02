import { JsonApiDto } from '../decorators';
import { JsonApiAttributes } from './json-api-attributes';
import { ApiProperty } from '@nestjs/swagger';
import { Organisation } from '@terramatch-microservices/database/entities';

const STATUSES = ['draft', 'pending', 'approved', 'rejected'];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: 'organisations' })
export class OrganisationDto extends JsonApiAttributes<OrganisationDto> {
  constructor(org: Organisation) {
    super({
      status: org.status as Status,
      name: org.name
    });
  }

  @ApiProperty({ enum: STATUSES })
  status: Status;

  @ApiProperty()
  name: string | null;
}
