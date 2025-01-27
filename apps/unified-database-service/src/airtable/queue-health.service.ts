import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from "@nestjs/terminus";
import { Queue } from "bullmq";

@Injectable()
export class QueueHealthService extends HealthIndicator {
  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {
    super();
  }

  public async queueHealthCheck(): Promise<HealthIndicatorResult> {
    const isHealthy = (await (await this.airtableQueue.client).ping()) === "PONG";
    if (!isHealthy) {
      throw new HealthCheckError("Redis connection for Airtable queue unavailable", {});
    }

    try {
      const data = {
        waitingJobs: await this.airtableQueue.getWaitingCount(),
        totalJobs: await this.airtableQueue.count()
      };

      return this.getStatus("redis-queue:airtable", isHealthy, data);
    } catch (error) {
      throw new HealthCheckError("Error fetching Airtable queue stats", error);
    }
  }
}
