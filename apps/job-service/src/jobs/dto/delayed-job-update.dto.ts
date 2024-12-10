import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class JobAttributes {
  @IsBoolean()
  @ApiProperty({ description: 'Value to set for isAcknowledged', example: true })
  isAcknowledged: boolean;
}

export class JobData {
  @ApiProperty({ enum: ['jobs'], description: 'Type of the resource', example: 'jobs' })
  type: 'jobs';

  @IsUUID()
  @ApiProperty({ format: 'uuid', description: 'UUID of the job', example: 'uuid-1' })
  uuid: string;

  @ValidateNested()
  @Type(() => JobAttributes)
  @ApiProperty({ description: 'Attributes to update for the job', type: JobAttributes })
  attributes: JobAttributes;
}

export class JobBulkUpdateBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobData)
  @ApiProperty({ description: 'List of jobs to update', type: [JobData] })
  data: JobData[];
}
