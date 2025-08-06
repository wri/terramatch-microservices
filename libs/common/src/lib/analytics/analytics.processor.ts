import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { TMLogger } from "../util/tm-logger";
import { AnalyticsEventService } from "./analytics-events.service";
import { Job } from "bullmq";
import * as Sentry from "@sentry/node";

type AnalyticsData = {
  uuid: string;
  params: object;
};

@Processor("analytics")
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new TMLogger(AnalyticsProcessor.name);

  constructor(private readonly analyticsEventService: AnalyticsEventService) {
    super();
  }

  async process(job: Job) {
    const { name, data } = job;
    const { uuid, params } = data as AnalyticsData;
    // For the analytics queue, the analytics data are sent along in the events, and we don't
    // have any specific processors for each event.
    await this.analyticsEventService.sendEvent(uuid, name, params);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
  }
}
