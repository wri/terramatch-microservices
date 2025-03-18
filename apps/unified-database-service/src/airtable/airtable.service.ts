import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DeleteEntitiesData, EntityType, UpdateAllData, UpdateEntitiesData } from "./airtable.processor";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DateTime } from "luxon";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Injectable()
export class AirtableService {
  private readonly logger = new TMLogger(AirtableService.name);

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

  @Cron(CronExpression.EVERY_DAY_AT_8PM)
  async handleDailyUpdate() {
    this.logger.log("Triggering daily update");
    await this.updateAll(DateTime.now().minus({ days: 2 }).toJSDate());
  }
}
