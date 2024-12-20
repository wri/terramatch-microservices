import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UnauthorizedException,
  Request,
  Patch,
  BadRequestException,
  Body,
  Logger
} from "@nestjs/common";
import { ApiException } from "@nanogiants/nestjs-swagger-api-exception-decorator";
import { ApiOperation } from "@nestjs/swagger";
import { Op } from "sequelize";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { DelayedJobDto } from "./dto/delayed-job.dto";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobBulkUpdateBodyDto } from "./dto/delayed-job-update.dto";

@Controller("jobs/v3/delayedJobs")
export class DelayedJobsController {
  @Get()
  @ApiOperation({
    operationId: "listDelayedJobs",
    description: "Retrieve a list of all delayed jobs."
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, {
    description: "Authentication failed."
  })
  async getRunningJobs(@Request() { authenticatedUserId }): Promise<JsonApiDocument> {
    const runningJobs = await DelayedJob.findAll({
      where: {
        isAcknowledged: false,
        createdBy: authenticatedUserId
      },
      order: [["createdAt", "DESC"]]
    });

    const jobsWithEntityNames = await Promise.all(
      runningJobs.map(async job => {
        const entityName = (job.metadata as { entity_name?: string }).entity_name;
        return { ...job.toJSON(), entityName };
      })
    );

    const document = buildJsonApi();
    jobsWithEntityNames.forEach(job => {
      document.addData(job.uuid, new DelayedJobDto(job));
    });
    return document.serialize();
  }
  @Get(":uuid")
  @ApiOperation({
    operationId: "delayedJobsFind",
    description: "Get the current status and potentially payload or error from a delayed job."
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, {
    description: "Authentication failed."
  })
  @ApiException(() => NotFoundException, {
    description: "Job with that UUID not found."
  })
  // Note: Since jobs are very generic and we don't track which resources are related to a given
  // job, there is no effective way to make a policy for jobs until we expand the service to
  // include an owner ID on the job table.
  async findOne(@Param("uuid") pathUUID: string): Promise<JsonApiDocument> {
    const job = await DelayedJob.findOne({ where: { uuid: pathUUID } });
    if (job == null) throw new NotFoundException();

    return buildJsonApi().addData(pathUUID, new DelayedJobDto(job)).document.serialize();
  }

  @Patch("bulk-update")
  @ApiOperation({
    operationId: "bulkUpdateJobs",
    summary: "Bulk update jobs to modify isAcknowledged for specified job IDs",
    description: `Accepts a JSON:API-compliant payload to bulk update jobs, allowing each job's isAcknowledged attribute to be set to true or false.`
  })
  @JsonApiResponse({ data: { type: DelayedJobDto } })
  @ApiException(() => UnauthorizedException, { description: "Authentication failed." })
  @ApiException(() => BadRequestException, { description: "Invalid payload or IDs provided." })
  @ApiException(() => NotFoundException, {
    description: "One or more jobs specified in the payload could not be found."
  })
  async bulkUpdateJobs(
    @Body() bulkUpdateJobsDto: DelayedJobBulkUpdateBodyDto,
    @Request() { authenticatedUserId }
  ): Promise<JsonApiDocument> {
    const jobUpdates = bulkUpdateJobsDto.data;
    const jobs = await DelayedJob.findAll({
      where: {
        uuid: { [Op.in]: jobUpdates.map(({ uuid }) => uuid) },
        createdBy: authenticatedUserId,
        status: { [Op.ne]: "pending" }
      },
      logging: console.log,
      order: [["createdAt", "DESC"]]
    });

    if (!jobs.length) {
      throw new NotFoundException("Some jobs in the request could not be updated");
    }

    const updatePromises = jobUpdates
      .filter(({ uuid }) => jobs.some(job => job.uuid === uuid))
      .map(async ({ uuid, attributes }) => {
        const job = jobs.find(job => job.uuid === uuid);
        job.isAcknowledged = attributes.isAcknowledged;
        await job.save();

        const entityName = (job.metadata as { entity_name?: string }).entity_name;

        return { ...job.toJSON(), entityName };
      });

    const updatedJobs = await Promise.all(updatePromises);

    const jsonApiBuilder = buildJsonApi();
    updatedJobs.forEach(job => {
      jsonApiBuilder.addData(job.uuid, new DelayedJobDto(job));
    });

    return jsonApiBuilder.serialize();
  }
}
