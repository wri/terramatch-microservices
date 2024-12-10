import { Controller, Get, NotFoundException, Param, UnauthorizedException, Request, Patch } from '@nestjs/common';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';
import { Op } from 'sequelize';
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
        isAknowledged: false,
        createdBy: authenticatedUserId
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
  // Note: Since jobs are very generic and we don't track which resources are related to a given
  // job, there is no effective way to make a policy for jobs until we expand the service to
  // include an owner ID on the job table.
  async findOne(@Param('uuid') pathUUID: string): Promise<JsonApiDocument> {
    const job = await DelayedJob.findOne({ where: { uuid: pathUUID } });
    if (job == null) throw new NotFoundException();

    return buildJsonApi()
      .addData(pathUUID, new DelayedJobDto(job))
      .document.serialize();
  }

  @Patch('clear')
  @ApiOperation({
    operationId: 'clearNonPendingJobs',
    description: 'Set isAknowledged to true for all jobs where status is not pending.',
  })
  @ApiException(() => UnauthorizedException, {
    description: 'Authentication failed.',
  })
  async clearNonPendingJobs(@Request() { authenticatedUserId }): Promise<{ message: string }> {
    const updatedCount = await DelayedJob.update(
      { isAknowledged: true },
      {
        where: {
          isAknowledged: false,
          status: { [Op.ne]: 'pending' },
          createdBy: authenticatedUserId,
        },
      }
    );

    return { message: `${updatedCount[0]} jobs have been cleared.` };
  }
}