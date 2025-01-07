import { Injectable, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { EntityType, UpdateEntitiesData } from "./airtable.processor";

@Injectable()
export class AirtableService {
  private readonly logger: LoggerService = new TMLogService(AirtableService.name);

  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {}

  // TODO (NJC) This method will probably go away entirely, or at least change drastically after this POC
  async updateAirtableJob(entityType: EntityType) {
    const data: UpdateEntitiesData = { entityType };

    this.logger.log(`Adding entity update to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("updateEntities", data);
  }
}
