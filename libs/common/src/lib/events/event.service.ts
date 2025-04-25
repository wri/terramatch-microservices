import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EntityStatusUpdate } from "./entity-status-update.event-processor";
import { StatusUpdateModel } from "@terramatch-microservices/database/types/util";

/**
 * A service to handle general events that are emitted in the common or database libraries, and
 * should be handled in all of our various microservice apps.
 */
@Injectable()
export class EventService {
  constructor(@InjectQueue("email") readonly emailQueue: Queue) {}

  @OnEvent("database.statusUpdated")
  async handleStatusUpdated(model: StatusUpdateModel) {
    await new EntityStatusUpdate(this, model).handle();
  }
}
