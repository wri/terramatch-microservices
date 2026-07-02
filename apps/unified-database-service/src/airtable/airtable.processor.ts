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
  UserEntity,
  DisturbanceReportEntity
} from "./entities";
import * as Sentry from "@sentry/node";
import { SlackService } from "@terramatch-microservices/common/slack/slack.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DataApiService } from "@terramatch-microservices/data-api";

export const AIRTABLE_ENTITIES = {
  applications: ApplicationEntity,
  disturbances: DisturbanceEntity,
  disturbanceReports: DisturbanceReportEntity,
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

// These are the Airtable base IDs that we use. They are defined in the ENV.
const BASES = {
  defaultBase: "AIRTABLE_BASE_ID",
  treeSpeciesBase: "AIRTABLE_TREE_SPECIES_BASE_ID"
} as const;

export type BaseId = keyof typeof BASES;

/**
 * Processes jobs in the airtable queue. Note that if we see problems with this crashing or
 * consuming too many resources, we have the option to run this in a forked process, although
 * it will involve some additional setup: https://docs.nestjs.com/techniques/queues#separate-processes
 */
@Processor("airtable")
export class AirtableProcessor extends WorkerHost {
  private readonly logger = new TMLogger(AirtableProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly slack: SlackService,
    private readonly dataApi: DataApiService
  ) {
    super();
  }

  private base(baseId: BaseId) {
    const apiKey = this.config.get<string>("AIRTABLE_API_KEY");
    if (apiKey == null) {
      /* istanbul ignore next */
      throw new InternalServerErrorException("Airtable API key must be set");
    }

    const airtableBaseId = this.config.get<string>(BASES[baseId]);
    if (airtableBaseId == null) {
      /* istanbul ignore next */
      throw new InternalServerErrorException(`${BASES[baseId]} must be set`);
    }

    return new Airtable({ apiKey }).base(airtableBaseId);
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
    this.logger.error(`Worker event failed ${JSON.stringify(job)}`, error);
    await this.sendSlackUpdate(`:warning: ERROR: Job processing failed: ${JSON.stringify(job)}`);
    await Sentry.flush(2000);
  }

  private async updateEntities({ entityType, startPage, updatedSince }: UpdateEntitiesData) {
    this.logger.log(`Beginning entity update: ${JSON.stringify({ entityType, updatedSince })}`);

    const entityClass = AIRTABLE_ENTITIES[entityType];
    if (entityClass == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    const entity = new entityClass(this.dataApi);
    await entity.updateBase(this.base(entity.BASE_ID), { startPage, updatedSince });

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
    await entity.deleteStaleRecords(this.base(entity.BASE_ID), deletedSince);

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
      this.logger.error("Send to slack failed", error instanceof Error ? error.stack : undefined);
    }
  }
}
