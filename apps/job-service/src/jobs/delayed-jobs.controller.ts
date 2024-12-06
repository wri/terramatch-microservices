import { Controller, Get, NotFoundException, Param, UnauthorizedException, Request } from '@nestjs/common';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';
import { User } from '@terramatch-microservices/database/entities';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import {
  buildJsonApi,
  JsonApiDocument,
} from '@terramatch-microservices/common/util';
import { DelayedJobDto } from './dto/delayed-job.dto';
import { DelayedJob } from '@terramatch-microservices/database/entities';

@Controller('jobs/v3/delayedJobs')
export class DelayedJobsController {
  @Get()
  @ApiOperation({
    operationId: 'listDelayedJobs',
    description: 'Retrieve a list of all delayed jobs.',
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, {
    description: 'Authentication failed.',
  })
  async getRunningJobs(
    @Request() { authenticatedUserId }
  ): Promise<JsonApiDocument> {
    const runningJobs = await DelayedJob.findAll({
      where: {
        is_cleared: 0,
        created_by: authenticatedUserId
      },
      order: [['createdAt', 'DESC']],
    });

    const document = buildJsonApi();
    runningJobs.forEach((job) => {
      document.addData(job.uuid, new DelayedJobDto(job));
    });
    return document.serialize();
  }

  @Get(':uuid')
  @ApiOperation({
    operationId: 'delayedJobsFind',
    description:
      'Get the current status and potentially payload or error from a delayed job.',
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, {
    description: 'Authentication failed.',
  })
  @ApiException(() => NotFoundException, {
    description: 'Job with that UUID not found.',
  })
  async findOne(@Param('uuid') pathUUID: string): Promise<JsonApiDocument> {
    const job = await DelayedJob.findOne({ where: { uuid: pathUUID } });
    if (job == null) throw new NotFoundException();

    return buildJsonApi()
      .addData(pathUUID, new DelayedJobDto(job))
      .document.serialize();
  }
}
