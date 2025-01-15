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
import { SlackService } from "nestjs-slack";

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

export type EntityType = keyof typeof AIRTABLE_ENTITIES;
export const ENTITY_TYPES = Object.keys(AIRTABLE_ENTITIES) as EntityType[];

export type UpdateEntitiesData = {
  entityType: EntityType;
  startPage?: number;
  updatedSince?: Date;
};

export type DeleteEntitiesData = {
  entityType: EntityType;
  deletedSince: Date;
};

export type UpdateAllData = {
  updatedSince: Date;
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

  constructor(private readonly config: ConfigService, private readonly slack: SlackService) {
    super();
    this.base = new Airtable({ apiKey: this.config.get("AIRTABLE_API_KEY") }).base(this.config.get("AIRTABLE_BASE_ID"));
  }

  async process(job: Job) {
    switch (job.name) {
      case "updateEntities":
        return await this.updateEntities(job.data as UpdateEntitiesData);

      case "deleteEntities":
        return await this.deleteEntities(job.data as DeleteEntitiesData);

      case "updateAll":
        return await this.updateAll(job.data as UpdateAllData);

      default:
        throw new NotImplementedException(`Unknown job type: ${job.name}`);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
    this.sendSlackUpdate(`ERROR: Job processing failed: ${JSON.stringify(job)}`);
  }

  private async updateEntities({ entityType, startPage, updatedSince }: UpdateEntitiesData) {
    this.logger.log(`Beginning entity update: ${JSON.stringify({ entityType, updatedSince })}`);

    const entityClass = AIRTABLE_ENTITIES[entityType];
    if (entityClass == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    const entity = new entityClass();
    await entity.updateBase(this.base, { startPage, updatedSince });

    this.logger.log(`Completed entity update: ${JSON.stringify({ entityType, updatedSince })}`);
    this.sendSlackUpdate(`Completed updating table "${entity.TABLE_NAME}" [updatedSince: ${updatedSince}]`);
  }

  private async deleteEntities({ entityType, deletedSince }: DeleteEntitiesData) {
    this.logger.log(`Beginning entity delete: ${JSON.stringify({ entityType, deletedSince })}`);

    const entityClass = AIRTABLE_ENTITIES[entityType];
    if (entityClass == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    const entity = new entityClass();
    await entity.deleteStaleRecords(this.base, deletedSince);

    this.logger.log(`Completed entity delete: ${JSON.stringify({ entityType, deletedSince })}`);
    this.sendSlackUpdate(`Completed deleting rows from table "${entity.TABLE_NAME}" [deletedSince: ${deletedSince}]`);
  }

  private async updateAll({ updatedSince }: UpdateAllData) {
    this.sendSlackUpdate(`Beginning sync of all data [changedSince: ${updatedSince}]`);
    for (const entityType of ENTITY_TYPES) {
      await this.updateEntities({ entityType, updatedSince });
      await this.deleteEntities({ entityType, deletedSince: updatedSince });
    }
    this.sendSlackUpdate(`Completed sync of all data [changedSince: ${updatedSince}]`);
  }

  private sendSlackUpdate(message: string) {
    const channel = this.config.get("UDB_SLACK_CHANNEL");
    if (channel == null) return;

    // Ignore promise; we don't want the process to fail if comms with Slack break down.
    this.slack.sendText(`UDB Update [${process.env.DEPLOY_ENV}]: ${message}`, { channel });
  }
}
