import { Controller, Get, NotFoundException, Param, UnauthorizedException, Request, Patch, BadRequestException, Body, Logger } from '@nestjs/common';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { Op } from 'sequelize';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import {
  buildJsonApi,
  JsonApiDocument,
} from '@terramatch-microservices/common/util';
import { DelayedJobDto } from './dto/delayed-job.dto';
import { DelayedJob } from '@terramatch-microservices/database/entities';
import { DelayedJobBulkUpdateBodyDto } from './dto/delayed-job-update.dto';

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
        isAcknowledged: false,
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

  @Patch('bulk-clear')
  @ApiOperation({
    operationId: 'bulkClearJobs',
    summary: 'Bulk update jobs to modify isAcknowledged for specified job IDs',
    description: `Accepts a JSON:API-compliant payload to bulk update jobs, allowing each job's isAcknowledged attribute to be set to true or false.`,
  })
  @ApiBody({
    description: 'JSON:API bulk update payload for jobs',
    type: DelayedJobBulkUpdateBodyDto,
    examples: {
      example: {
        value: {
          data: [
            {
              type: 'jobs',
              uuid: 'uuid-1',
              attributes: {
                isAcknowledged: true,
              },
            },
            {
              type: 'jobs',
              uuid: 'uuid-2',
              attributes: {
                isAcknowledged: false,
              },
            },
          ],
        },
      },
    },
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, { description: 'Authentication failed.' })
  @ApiException(() => BadRequestException, { description: 'Invalid payload or IDs provided.' })
  @ApiException(() => NotFoundException, { description: 'One or more jobs specified in the payload could not be found.' })
  async bulkClearJobs(
    @Body() bulkClearJobsDto: DelayedJobBulkUpdateBodyDto,
    @Request() { authenticatedUserId }
  ): Promise<JsonApiDocument> {
    const jobUpdates = bulkClearJobsDto.data;
  
    if (!jobUpdates || jobUpdates.length === 0) {
      throw new BadRequestException('No jobs provided in the payload.');
    }
  
    if (!authenticatedUserId) {
      throw new UnauthorizedException('Authentication failed.');
    }
    const updatePromises = jobUpdates.map(async (job) => {
      const [updatedCount] = await DelayedJob.update(
        { isAcknowledged: job.attributes.isAcknowledged },
        {
          where: {
            uuid: job.uuid,
            createdBy: authenticatedUserId,
            status: { [Op.ne]: 'pending' },
          },
        });
    
      if (updatedCount === 0) {
        throw new NotFoundException(`Job with UUID ${job.uuid} could not be updated.`);
      }
    
      const updatedJob = await DelayedJob.findOne({
        where: { uuid: job.uuid },
      });

      return updatedJob;
    });
    
    const updatedJobs = await Promise.all(updatePromises);
    
    
    const jsonApiBuilder = buildJsonApi();
    updatedJobs.forEach((job) => {
      jsonApiBuilder.addData(job.uuid, new DelayedJobDto(job));
    });
    
    return jsonApiBuilder.serialize();
    
  }
}