import { User } from "@terramatch-microservices/database/entities";
import { RequestContext } from "nestjs-request-context";
import { EventService } from "./event.service";

export abstract class EventProcessor {
  protected constructor(protected readonly eventService: EventService) {}

  async getAuthenticatedUser() {
    const userId = RequestContext.currentContext?.req?.authenticatedUserId as number | null | undefined;
    if (userId == null) return null;

    return await User.findOne({
      where: { id: userId },
      attributes: ["id", "emailAddress", "firstName", "lastName"]
    });
  }

  abstract handle(): Promise<void>;
}
