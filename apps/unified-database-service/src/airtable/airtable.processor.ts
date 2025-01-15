import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { InternalServerErrorException, LoggerService, NotImplementedException } from "@nestjs/common";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import Airtable from "airtable";
import {
  ApplicationEntity,
  NurseryEntity,
  NurseryReportEntity,
  OrganisationEntity,
  ProjectEntity,
  ProjectReportEntity,
  SiteEntity,
  SiteReportEntity,
  TreeSpeciesEntity
} from "./entities";
import * as Sentry from "@sentry/node";

export const AIRTABLE_ENTITIES = {
  application: ApplicationEntity,
  nursery: NurseryEntity,
  "nursery-report": NurseryReportEntity,
  organisation: OrganisationEntity,
  project: ProjectEntity,
  "project-report": ProjectReportEntity,
  site: SiteEntity,
  "site-report": SiteReportEntity,
  "tree-species": TreeSpeciesEntity
};

export const ENTITY_TYPES = Object.keys(AIRTABLE_ENTITIES);
export type EntityType = keyof typeof AIRTABLE_ENTITIES;
export type UpdateEntitiesData = {
  entityType: EntityType;
  startPage?: number;
  updatedSince?: Date;
};

export type DeleteEntitiesData = {
  entityType: EntityType;
  deletedSince: Date;
};

/**
 * Processes jobs in the airtable queue. Note that if we see problems with this crashing or
 * consuming too many resources, we have the option to run this in a forked process, although
 * it will involve some additional setup: https://docs.nestjs.com/techniques/queues#separate-processes
 */
@Processor("airtable")
export class AirtableProcessor extends WorkerHost {
  private readonly logger: LoggerService = new TMLogService(AirtableProcessor.name);
  private readonly base: Airtable.Base;

  constructor(configService: ConfigService) {
    super();
    this.base = new Airtable({ apiKey: configService.get("AIRTABLE_API_KEY") }).base(
      configService.get("AIRTABLE_BASE_ID")
    );
  }

  async process(job: Job) {
    switch (job.name) {
      case "updateEntities":
        return await this.updateEntities(job.data as UpdateEntitiesData);

      case "deleteEntities":
        return await this.deleteEntities(job.data as DeleteEntitiesData);

      default:
        throw new NotImplementedException(`Unknown job type: ${job.name}`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
  }

  private async updateEntities({ entityType, startPage, updatedSince }: UpdateEntitiesData) {
    this.logger.log(`Beginning entity update: ${JSON.stringify({ entityType })}`);

    const airtableEntity = AIRTABLE_ENTITIES[entityType];
    if (airtableEntity == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    await new airtableEntity().updateBase(this.base, { startPage, updatedSince });

    this.logger.log(`Completed entity update: ${JSON.stringify({ entityType })}`);
  }

  private async deleteEntities({ entityType, deletedSince }: DeleteEntitiesData) {
    this.logger.log(`Beginning entity delete: ${JSON.stringify({ entityType, deletedSince })}`);

    const airtableEntity = AIRTABLE_ENTITIES[entityType];
    if (airtableEntity == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    await new airtableEntity().deleteStaleRecords(this.base, deletedSince);

    this.logger.log(`Completed entity delete: ${JSON.stringify({ entityType, deletedSince })}`);
  }
}
