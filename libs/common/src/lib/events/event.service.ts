import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EntityStatusUpdate } from "./entity-status-update.event-processor";
import { StatusUpdateModel } from "@terramatch-microservices/database/types/util";
import { TMLogger } from "../util/tm-logger";
import { MediaService } from "../media/media.service";

/**
 * A service to handle general events that are emitted in the common or database libraries, and
 * should be handled in all of our various microservice apps.
 */
@Injectable()
export class EventService {
  private readonly logger = new TMLogger(EventService.name);

  constructor(
    @InjectQueue("email") readonly emailQueue: Queue,
    @InjectQueue("analytics") readonly analyticsQueue: Queue,
    @InjectQueue("entities") readonly entitiesQueue: Queue,
    readonly mediaService: MediaService
  ) {}

  @OnEvent("database.statusUpdated")
  async handleStatusUpdated(model: StatusUpdateModel) {
    await new EntityStatusUpdate(this, model).handle();
  }

  async sendStatusUpdateAnalytics(modelUuid: string, modelLaravelType: string, status: string) {
    this.logger.log(`Sending status update analytics for ${modelUuid}, ${modelLaravelType} to queue.`);
    await this.analyticsQueue.add("modelStatusUpdate", {
      uuid: modelUuid,
      params: { modelType: modelLaravelType, status }
    });
  }
}
