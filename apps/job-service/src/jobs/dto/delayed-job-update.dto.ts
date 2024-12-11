import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DelayedJobAttributes {
  @IsBoolean()
  @ApiProperty({ description: 'Value to set for isAcknowledged', example: true })
  isAcknowledged: boolean;
}

export class DelayedJobData {
  @ApiProperty({ enum: ['delayedJobs'], description: 'Type of the resource', example: 'delayedJobs' })
  type: 'delayedJobs';

  @IsUUID()
  @ApiProperty({ format: 'uuid', description: 'UUID of the job', example: 'uuid-1' })
  uuid: string;

  @ValidateNested()
  @Type(() => DelayedJobAttributes)
  @ApiProperty({ description: 'Attributes to update for the job', type: DelayedJobAttributes })
  attributes: DelayedJobAttributes;
}

export class DelayedJobBulkUpdateBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DelayedJobData)
  @ApiProperty({ description: 'List of jobs to update isAcknowledged', type: [DelayedJobData] })
  data: DelayedJobData[];
}
