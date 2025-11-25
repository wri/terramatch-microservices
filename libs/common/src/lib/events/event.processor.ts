import { RequestContext } from "nestjs-request-context";
import { EventService } from "./event.service";

export abstract class EventProcessor {
  protected constructor(protected readonly eventService: EventService) {}

  get authenticatedUserId() {
    return RequestContext.currentContext?.req?.authenticatedUserId as number | null | undefined;
  }

  abstract handle(): Promise<void>;
}
