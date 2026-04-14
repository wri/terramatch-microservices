import { Processor, WorkerHost } from "@nestjs/bullmq";
import { GreenhouseNotificationService } from "./greenhouse-notification.service";
import { Job } from "bullmq";

@Processor("greenhouse")
export class GreenhouseNotificationProcessor extends WorkerHost {
  constructor(private readonly greenhouseNotificationService: GreenhouseNotificationService) {
    super();
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
