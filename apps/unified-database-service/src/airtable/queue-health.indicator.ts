import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { Queue } from "bullmq";

@Injectable()
export class QueueHealthIndicator {
  constructor(
    @InjectQueue("airtable") private readonly airtableQueue: Queue,
    private readonly healthIndicatorService: HealthIndicatorService
  ) {}

  public async isHealthy() {
    const indicator = this.healthIndicatorService.check("redis-queue:airtable");

    const isHealthy = (await (await this.airtableQueue.client).ping()) === "PONG";
    if (!isHealthy) {
      return indicator.down({ message: "Redis connection for Airtable queue unavailable" });
    }

    try {
      const data = {
        waitingJobs: await this.airtableQueue.getWaitingCount(),
        totalJobs: await this.airtableQueue.count()
      };

      return indicator.up(data);
    } catch (error) {
      return indicator.down({ message: "Error fetching Airtable queue stats", error });
    }
  }
}
