import { Injectable, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { DeleteEntitiesData, EntityType, UpdateAllData, UpdateEntitiesData } from "./airtable.processor";

@Injectable()
export class AirtableService {
  private readonly logger: LoggerService = new TMLogService(AirtableService.name);

  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {}

  async updateAirtable(entityType: EntityType, startPage?: number, updatedSince?: Date) {
    const data: UpdateEntitiesData = { entityType, startPage, updatedSince };

    this.logger.log(`Adding entity update to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("updateEntities", data);
  }

  async deleteFromAirtable(entityType: EntityType, deletedSince: Date) {
    const data: DeleteEntitiesData = { entityType, deletedSince };

    this.logger.log(`Adding entity delete to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("deleteEntities", data);
  }

  async updateAll(updatedSince: Date) {
    const data: UpdateAllData = { updatedSince };

    this.logger.log(`Adding update all to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("updateAll", data);
  }
}
