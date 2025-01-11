import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InternalServerErrorException, LoggerService, NotImplementedException, Scope } from "@nestjs/common";
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
};

/**
 * Processes jobs in the airtable queue. Note that if we see problems with this crashing or
 * consuming too many resources, we have the option to run this in a forked process, although
 * it will involve some additional setup: https://docs.nestjs.com/techniques/queues#separate-processes
 *
 * Scope.REQUEST causes this processor to get created fresh for each event in the Queue, which means
 * that it will be fully garbage collected after its work is done.
 */
@Processor({ name: "airtable", scope: Scope.REQUEST })
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

      default:
        throw new NotImplementedException(`Unknown job type: ${job.name}`);
    }
  }

  private async updateEntities({ entityType, startPage }: UpdateEntitiesData) {
    this.logger.log(`Beginning entity update: ${JSON.stringify({ entityType })}`);

    const airtableEntity = AIRTABLE_ENTITIES[entityType];
    if (airtableEntity == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    await new airtableEntity().updateBase(this.base, startPage);

    this.logger.log(`Completed entity update: ${JSON.stringify({ entityType })}`);
  }
}
