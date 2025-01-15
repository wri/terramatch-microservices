import { Injectable, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { DeleteEntitiesData, EntityType, UpdateEntitiesData } from "./airtable.processor";

@Injectable()
export class AirtableService {
  private readonly logger: LoggerService = new TMLogService(AirtableService.name);

  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {}

  async updateAirtableJob(entityType: EntityType, startPage?: number) {
    const data: UpdateEntitiesData = { entityType, startPage };

    this.logger.log(`Adding entity update to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("updateEntities", data);
  }

  async deleteAirtableJob(entityType: EntityType, deletedSince: Date) {
    const data: DeleteEntitiesData = { entityType, deletedSince };

    this.logger.log(`Adding entity delete to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("deleteEntities", data);
  }
}
