import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { InternalServerErrorException, LoggerService, NotImplementedException } from "@nestjs/common";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import Airtable from "airtable";
import {
  ApplicationEntity,
  DemographicEntity,
  DemographicEntryEntity,
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
import { SlackService } from "@terramatch-microservices/common/slack/slack.service";

export const AIRTABLE_ENTITIES = {
  applications: ApplicationEntity,
  demographics: DemographicEntity,
  demographicEntries: DemographicEntryEntity,
  nurseries: NurseryEntity,
  nurseryReports: NurseryReportEntity,
  organisations: OrganisationEntity,
  projects: ProjectEntity,
  projectReports: ProjectReportEntity,
  sites: SiteEntity,
  siteReports: SiteReportEntity,
  treeSpecies: TreeSpeciesEntity
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
    const { name, data } = job;
    await this.sendSlackUpdate(`:construction_worker: Beginning job: ${JSON.stringify({ name, data })}`);
    switch (name) {
      case "updateEntities":
        return await this.updateEntities(data as UpdateEntitiesData);

      case "deleteEntities":
        return await this.deleteEntities(data as DeleteEntitiesData);

      case "updateAll":
        return await this.updateAll(data as UpdateAllData);

      default:
        throw new NotImplementedException(`Unknown job type: ${name}`);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
    await this.sendSlackUpdate(`:warning: ERROR: Job processing failed: ${JSON.stringify(job)}`);
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
    await this.sendSlackUpdate(`Completed updating table "${entity.TABLE_NAME}" [updatedSince: ${updatedSince}]`);
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
    await this.sendSlackUpdate(
      `Completed deleting rows from table "${entity.TABLE_NAME}" [deletedSince: ${deletedSince}]`
    );
  }

  private async updateAll({ updatedSince }: UpdateAllData) {
    await this.sendSlackUpdate(`:white_check_mark: Beginning sync of all data [changedSince: ${updatedSince}]`);
    for (const entityType of ENTITY_TYPES) {
      await this.updateEntities({ entityType, updatedSince });
      await this.deleteEntities({ entityType, deletedSince: updatedSince });
    }
    await this.sendSlackUpdate(`:100: Completed sync of all data [changedSince: ${updatedSince}]`);
  }

  private async sendSlackUpdate(message: string) {
    const channel = this.config.get("UDB_SLACK_CHANNEL");
    if (channel == null) return;

    try {
      await this.slack.sendTextToChannel(`[${process.env.DEPLOY_ENV}]: ${message}`, channel);
    } catch (error) {
      // Don't allow a failure in slack sending to hose our process, but do log it and send it to Sentry
      Sentry.captureException(error);
      this.logger.error("Send to slack failed", error.stack);
    }
  }
}
