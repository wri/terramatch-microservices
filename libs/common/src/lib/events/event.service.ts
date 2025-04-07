import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Project } from "@terramatch-microservices/database/entities";
import { Model } from "sequelize-typescript";

/**
 * A service to handle general events that are emitted in the common or database libraries, and
 * should be handled in all of our various microservice apps.
 */
@Injectable()
export class EventService {
  @OnEvent("database.statusUpdated")
  handleStatusUpdated(model: Model) {
    console.log("handle status change", { model: model instanceof Project });
  }
}
