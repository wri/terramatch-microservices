import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { Op } from "sequelize";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, buildDelayedJobResponse } from "@terramatch-microservices/common/util";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobBulkUpdateBodyDto } from "./dto/delayed-job-update.dto";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

@Controller("jobs/v3/delayedJobs")
export class DelayedJobsController {
  @Get()
  @ApiOperation({
    operationId: "listDelayedJobs",
    description: "Retrieve a list of all delayed jobs."
  })
  @JsonApiResponse({ data: DelayedJobDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  async getRunningJobs() {
    const runningJobs = await DelayedJob.findAll({
      where: {
        isAcknowledged: false,
        createdBy: authenticatedUserId()
      },
      order: [["createdAt", "DESC"]]
    });

    return runningJobs
      .reduce(
        (document, job) => document.addData(job.uuid, new DelayedJobDto(job)).document,
        buildJsonApi(DelayedJobDto, { forceDataArray: true })
      )
      .addIndex({ requestPath: "/jobs/v3/delayedJobs" });
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "delayedJobsFind",
    description: "Get the current status and potentially payload or error from a delayed job."
  })
  @JsonApiResponse(DelayedJobDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Job with that UUID not found." })
  // Note: Since jobs are very generic and we don't track which resources are related to a given
  // job, there is no effective way to make a policy for jobs until we expand the service to
  // include an owner ID on the job table.
  async findOne(@Param("uuid") pathUUID: string) {
    const job = await DelayedJob.findOne({ where: { uuid: pathUUID } });
    if (job == null) throw new NotFoundException();

    return buildDelayedJobResponse(job);
  }

  @Patch("bulk-update")
  @ApiOperation({
    operationId: "bulkUpdateJobs",
    summary: "Bulk update jobs to modify isAcknowledged for specified job IDs",
    description: `Accepts a JSON:API-compliant payload to bulk update jobs, allowing each job's isAcknowledged attribute to be set to true or false.`
  })
  @JsonApiResponse(DelayedJobDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid payload or IDs provided." })
  @ExceptionResponse(NotFoundException, {
    description: "One or more jobs specified in the payload could not be found."
  })
  async bulkUpdateJobs(@Body() bulkUpdateJobsDto: DelayedJobBulkUpdateBodyDto) {
    const jobUpdates = bulkUpdateJobsDto.data;
    const jobs = await DelayedJob.findAll({
      where: {
        uuid: { [Op.in]: jobUpdates.map(({ uuid }) => uuid) },
        createdBy: authenticatedUserId()
      },
      order: [["createdAt", "DESC"]]
    });

    if (jobs.length !== jobUpdates.length) {
      throw new NotFoundException("Some jobs in the request could not be updated");
    }

    const updatedJobs = (
      await Promise.all(
        jobUpdates
          .filter(({ uuid }) => jobs.some(job => job.uuid === uuid))
          .map(async ({ uuid, attributes }) => {
            const job = jobs.find(job => job.uuid === uuid);
            return await job?.update({ isAcknowledged: attributes.isAcknowledged });
          })
      )
    ).filter(isNotNull);

    return updatedJobs.reduce(
      (document, job) => document.addData(job.uuid, new DelayedJobDto(job)).document,
      buildJsonApi(DelayedJobDto)
    );
  }
}
