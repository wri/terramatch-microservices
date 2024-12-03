import { Injectable, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";

export type EntityType = "project";

export type UpdateEntitiesData = {
  entityType: EntityType;
  entityUuid: string;
};

@Injectable()
export class AirtableService {
  private readonly logger: LoggerService = new TMLogService(AirtableService.name);

  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {}

  // TODO (NJC) This method will probably go away entirely, or at least change drastically after this POC
  async updateAirtableJob(entityType: EntityType, entityUuid: string) {
    const data: UpdateEntitiesData = { entityType, entityUuid };

    this.logger.log(`Adding entity update to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("updateEntities", data);
  }
}
