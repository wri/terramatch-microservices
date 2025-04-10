import { User } from "@terramatch-microservices/database/entities";
import { RequestContext } from "nestjs-request-context";
import { EventService } from "./event.service";

export abstract class EventProcessor {
  constructor(protected readonly eventService: EventService) {}

  private _authenticatedUser?: User | null;
  async getAuthenticatedUser() {
    if (this._authenticatedUser != null) return this._authenticatedUser;

    const userId = RequestContext.currentContext.req.authenticatedUserId as number | null;
    if (userId == null) return null;

    return (this._authenticatedUser = await User.findOne({
      where: { id: userId },
      attributes: ["id", "emailAddress", "firstName", "lastName"]
    }));
  }

  abstract handle(): Promise<void>;
}
