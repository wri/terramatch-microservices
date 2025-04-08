import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Model } from "sequelize-typescript";
import { InjectQueue } from "@nestjs/bullmq";
import { TMLogger } from "../util/tm-logger";
import { Queue } from "bullmq";
import { ENTITY_MODELS } from "@terramatch-microservices/database/constants/entities";
import { StatusUpdateData } from "../email/email.processor";

/**
 * A service to handle general events that are emitted in the common or database libraries, and
 * should be handled in all of our various microservice apps.
 */
@Injectable()
export class EventService {
  private readonly logger = new TMLogger(EventService.name);

  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  @OnEvent("database.statusUpdated")
  async handleStatusUpdated(model: Model & { status: string }) {
    this.logger.log("Received model status update", {
      type: model.constructor.name,
      id: model.id,
      status: model.status
    });

    const type = Object.entries(ENTITY_MODELS).find(([, entityClass]) => model instanceof entityClass)?.[0];
    if (type == null) {
      this.logger.error("Status update not an entity model", { type: model.constructor.name });
      return;
    }

    this.logger.log("Sending status update to email queue", { type, id: model.id });
    await this.emailQueue.add("statusUpdate", { type, id: model.id } as StatusUpdateData);
  }
}
