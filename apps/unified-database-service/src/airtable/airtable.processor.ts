import { Processor, WorkerHost } from "@nestjs/bullmq";
import { LoggerService, NotImplementedException, Scope } from "@nestjs/common";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { Job } from "bullmq";
import { UpdateEntitiesData } from "./airtable.service";

/**
 * Processes jobs in the airtable queue. Note that if we see problems with this crashing or
 * consuming too many resources, we have the option to run this in a forked process, although
 * it will involve some additional setup: https://docs.nestjs.com/techniques/queues#separate-processes
 */
@Processor({ name: "airtable", scope: Scope.REQUEST })
export class AirtableProcessor extends WorkerHost {
  private readonly logger: LoggerService = new TMLogService(AirtableProcessor.name);

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
  }
}
