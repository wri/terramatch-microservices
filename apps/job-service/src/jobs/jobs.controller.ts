import { Controller, Get, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import {
  buildJsonApi,
  JsonApiDocument,
} from '@terramatch-microservices/common/util';
import { JobDto } from './dto/job.dto';

@Controller('jobs/v3/jobs')
export class JobsController {
  @Get(':uuid')
  @ApiOperation({
    operationId: 'jobsFind',
    description: 'Get the current status and potentially payload or error from a delayed job.',
  })
  @JsonApiResponse({ data: { type: JobDto } })
  @ApiException(() => UnauthorizedException, {
    description: 'Authentication failed.',
  })
  @ApiException(() => NotFoundException, {
    description: 'Job with that UUID not found.'
  })
  async findOne(@Param('uuid') pathUUID: string): Promise<JsonApiDocument> {
    return buildJsonApi()
      .addData(pathUUID, new JobDto({ status: 'pending' }))
      .document.serialize();
  }
}
