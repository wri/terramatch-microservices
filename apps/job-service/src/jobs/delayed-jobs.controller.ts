import { Controller, Get, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import {
  buildJsonApi,
  JsonApiDocument,
} from '@terramatch-microservices/common/util';
import { DelayedJobDto } from './dto/delayed-job.dto';
import { DelayedJob } from '@terramatch-microservices/database/entities';

@Controller('jobs/v3/delayedJobs')
export class DelayedJobsController {
  @Get(':uuid')
  @ApiOperation({
    operationId: 'delayedJobsFind',
    description: 'Get the current status and potentially payload or error from a delayed job.',
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, {
    description: 'Authentication failed.',
  })
  @ApiException(() => NotFoundException, {
    description: 'Job with that UUID not found.'
  })
  async findOne(@Param('uuid') pathUUID: string): Promise<JsonApiDocument> {
    const job = await DelayedJob.findOne({ where: { uuid: pathUUID }});
    if (job == null) throw new NotFoundException();

    // Note: Since jobs are very generic and we don't track which resources are related to a given
    // job, there is no effective way to make a policy for jobs until we expand the service to
    // include an owner ID on the job table.

    return buildJsonApi()
      .addData(pathUUID, new DelayedJobDto(job))
      .document.serialize();
  }
}
