import { EventService } from "./event.service";

export abstract class EventProcessor {
  protected constructor(protected readonly eventService: EventService) {}

  abstract handle(): Promise<void>;
}
