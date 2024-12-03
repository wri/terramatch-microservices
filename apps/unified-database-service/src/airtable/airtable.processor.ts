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
import * as inflection from "inflection";
import { Project } from "@terramatch-microservices/database/entities";

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
        await this.updateEntities(job.data as UpdateEntitiesData);
        break;

      default:
        throw new NotImplementedException(`Unknown job type: ${job.name}`);
    }
  }

  private async updateEntities({ entityType, entityUuid }: UpdateEntitiesData) {
    this.logger.log(`Beginning entity update: ${JSON.stringify({ entityType, entityUuid })}`);
    const tableName = inflection.pluralize(inflection.titleize(entityType));
    const records = await this.base(tableName)
      .select({ maxRecords: 2, filterByFormula: `{uuid} = '${entityUuid}'` })
      .firstPage();
    if (records.length === 0) {
      this.logger.error(`No ${entityType} with UUID ${entityUuid} found in Airtable`);
      throw new NotFoundException(`No ${entityType} with UUID ${entityUuid} found in Airtable`);
    } else if (records.length > 1) {
      this.logger.error(`More than one ${entityType} with UUID ${entityUuid} found in Airtable`);
      throw new InternalServerErrorException(`More than one ${entityType} with UUID ${entityUuid} found in Airtable`);
    }

    let record;
    switch (entityType) {
      case "project":
        record = await Project.findOne({ where: { uuid: entityUuid } });
        break;
    }

    this.base(tableName).update(records[0].id, { project_name: record.name });
    this.logger.log(`Entity update complete: ${JSON.stringify({ entityType, entityUuid })}`);
  }
}
