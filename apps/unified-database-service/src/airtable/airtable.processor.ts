import { Processor, WorkerHost } from "@nestjs/bullmq";
import {
  InternalServerErrorException,
  LoggerService,
  NotFoundException,
  NotImplementedException,
  Scope
} from "@nestjs/common";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { Job } from "bullmq";
import { UpdateEntitiesData } from "./airtable.service";
import { ConfigService } from "@nestjs/config";
import Airtable from "airtable";
import { ProjectEntity } from "./entities";
import { AirtableEntity } from "./entities/airtable-entity";
import { Model } from "sequelize-typescript";
import { FieldSet } from "airtable/lib/field_set";
import { Records } from "airtable/lib/records";

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

    // const id = await this.findAirtableEntity(airtableEntity, entityUuid);
    const record = await airtableEntity.findOne(entityUuid);
    this.logger.log(`Entity mapping: ${JSON.stringify(await airtableEntity.mapDbEntity(record), null, 2)}`);
    // try {
    //   await this.base(airtableEntity.TABLE_NAME).update(id, await airtableEntity.mapDbEntity(record));
    // } catch (error) {
    //   this.logger.error(
    //     `Entity update failed: ${JSON.stringify({
    //       entityType,
    //       entityUuid,
    //       error
    //     })}`
    //   );
    //   throw error;
    // }
    // this.logger.log(`Entity update complete: ${JSON.stringify({ entityType, entityUuid })}`);
  }

  private async findAirtableEntity<T extends Model<T>>(entity: AirtableEntity<T>, entityUuid: string) {
    let records: Records<FieldSet>;
    try {
      records = await this.base(entity.TABLE_NAME)
        .select({
          maxRecords: 2,
          fields: [entity.UUID_COLUMN],
          filterByFormula: `{${entity.UUID_COLUMN}} = '${entityUuid}'`
        })
        .firstPage();
    } catch (error) {
      this.logger.error(
        `Error finding entity in Airtable: ${JSON.stringify({ table: entity.TABLE_NAME, entityUuid, error })}`
      );
      throw new NotFoundException(`No ${entity.TABLE_NAME} with UUID ${entityUuid} found in Airtable`);
    }

    if (records.length === 0) {
      this.logger.error(`No ${entity.TABLE_NAME} with UUID ${entityUuid} found in Airtable`);
      throw new NotFoundException(`No ${entity.TABLE_NAME} with UUID ${entityUuid} found in Airtable`);
    } else if (records.length > 1) {
      this.logger.error(`More than one ${entity.TABLE_NAME} with UUID ${entityUuid} found in Airtable`);
      throw new InternalServerErrorException(
        `More than one ${entity.TABLE_NAME} with UUID ${entityUuid} found in Airtable`
      );
    }

    return records[0].id;
  }
}
