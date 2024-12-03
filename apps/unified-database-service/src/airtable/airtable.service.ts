import { Injectable, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";

export type UpdateEntitiesData = {
  entityType: "Project" | "Organisation";
  entityUuid: string;
};

@Injectable()
export class AirtableService {
  private readonly logger: LoggerService = new TMLogService(AirtableService.name);

  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {}

  async updateAirtableJob() {
    const data: UpdateEntitiesData = {
      entityType: "Project",
      entityUuid: "asdfasdfasdf"
    };

    this.logger.log(`Adding entity update to queue: ${JSON.stringify(data)}`);
    await this.airtableQueue.add("updateEntities", data);
  }
}
