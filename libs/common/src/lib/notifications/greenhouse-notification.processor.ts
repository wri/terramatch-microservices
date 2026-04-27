import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { GreenhouseNotificationService } from "./greenhouse-notification.service";
import { Job } from "bullmq";
import { TMLogger } from "../util/tm-logger";
import * as Sentry from "@sentry/nestjs";

@Processor("greenhouse")
export class GreenhouseNotificationProcessor extends WorkerHost {
  private readonly logger = new TMLogger(GreenhouseNotificationProcessor.name);

  constructor(private readonly greenhouseNotificationService: GreenhouseNotificationService) {
    super();
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    this.logger.error("Job failed", error, job);
    await Sentry.flush(2000);
  }

  async process(job: Job) {
    const { name, data } = job;
    switch (name) {
      case "mediaDeleted":
        await this.greenhouseNotificationService.notifyMediaDeletion(data);
        break;
      case "polygonUpdated":
        await this.greenhouseNotificationService.notifyPolygonUpdated(data);
        break;
    }
  }
}
