import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InternalServerErrorException, LoggerService, NotImplementedException, Scope } from "@nestjs/common";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { Job } from "bullmq";
import { UpdateEntitiesData } from "./airtable.service";
import { ConfigService } from "@nestjs/config";
import Airtable from "airtable";
import { ProjectEntity } from "./entities";

const AIRTABLE_ENTITIES = {
  project: ProjectEntity
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

  private async updateEntities({ entityType, entityUuid }: UpdateEntitiesData) {
    this.logger.log(`Beginning entity update: ${JSON.stringify({ entityType, entityUuid })}`);

    const airtableEntity = AIRTABLE_ENTITIES[entityType];
    if (airtableEntity == null) {
      throw new InternalServerErrorException(`Entity mapping not found for entity type ${entityType}`);
    }

    const record = await airtableEntity.findOne(entityUuid);
    try {
      const airtableRecord = await airtableEntity.mapDbEntity(record);
      // @ts-expect-error The types for this lib haven't caught up with its support for upserts
      // https://github.com/Airtable/airtable.js/issues/348
      await this.base(airtableEntity.TABLE_NAME).update([{ fields: airtableRecord }], {
        performUpsert: { fieldsToMergeOn: ["uuid"] }
      });
    } catch (error) {
      this.logger.error(
        `Entity update failed: ${JSON.stringify({
          entityType,
          entityUuid,
          error
        })}`
      );
      throw error;
    }
    this.logger.log(`Entity update complete: ${JSON.stringify({ entityType, entityUuid })}`);
  }
}
