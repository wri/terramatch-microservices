import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import { Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import Airtable from "airtable";
import {
  ApplicationEntity,
  TrackingEntity,
  TrackingEntryEntity,
  DisturbanceEntity,
  FinancialIndicatorEntity,
  FinancialReportEntity,
  FundingProgrammeEntity,
  FundingTypeEntity,
  InvasiveEntity,
  InvestmentEntity,
  InvestmentSplitEntity,
  LeadershipEntity,
  NurseryEntity,
  NurseryReportEntity,
  OrganisationEntity,
  ProjectEntity,
  ProjectPitchEntity,
  ProjectReportEntity,
  SeedingEntity,
  SiteEntity,
  SitePolygonEntity,
  SiteReportEntity,
  SrpReportEntity,
  StrataEntity,
  TreeSpeciesEntity,
  UserEntity
} from "./entities";
import * as Sentry from "@sentry/node";
import { SlackService } from "@terramatch-microservices/common/slack/slack.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DataApiService } from "@terramatch-microservices/data-api";

export const AIRTABLE_ENTITIES = {
  applications: ApplicationEntity,
  disturbances: DisturbanceEntity,
  financialIndicators: FinancialIndicatorEntity,
  financialReports: FinancialReportEntity,
  fundingProgrammes: FundingProgrammeEntity,
  fundingTypes: FundingTypeEntity,
  invasives: InvasiveEntity,
  investments: InvestmentEntity,
  investmentSplits: InvestmentSplitEntity,
  leaderships: LeadershipEntity,
  nurseries: NurseryEntity,
  nurseryReports: NurseryReportEntity,
  organisations: OrganisationEntity,
  projects: ProjectEntity,
  projectPitches: ProjectPitchEntity,
  projectReports: ProjectReportEntity,
  seedings: SeedingEntity,
  sites: SiteEntity,
  sitePolygons: SitePolygonEntity,
  siteReports: SiteReportEntity,
  srpReports: SrpReportEntity,
  stratas: StrataEntity,
  trackings: TrackingEntity,
  trackingEntries: TrackingEntryEntity,
  treeSpecies: TreeSpeciesEntity,
  users: UserEntity
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
  private readonly logger = new TMLogger(AirtableProcessor.name);
  private readonly base: Airtable.Base;

  constructor(
    private readonly config: ConfigService,
    private readonly slack: SlackService,
    private readonly dataApi: DataApiService
  ) {
    super();

    const apiKey = this.config.get<string>("AIRTABLE_API_KEY");
    const baseId = this.config.get<string>("AIRTABLE_BASE_ID");
    if (apiKey == null || baseId == null) {
      /* istanbul ignore next */
      throw new InternalServerErrorException("Airtable API key and base ID must be set");
    }

    this.base = new Airtable({ apiKey }).base(baseId);
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

  /* istanbul ignore next */
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

    const entity = new entityClass(this.dataApi);
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

    const entity = new entityClass(this.dataApi);
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
    } catch (error) /* istanbul ignore next */ {
      // Don't allow a failure in slack sending to hose our process, but do log it and send it to Sentry
      Sentry.captureException(error);
      this.logger.error("Send to slack failed", error.stack);
    }
  }
}
