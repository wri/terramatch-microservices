import { getQueueToken } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { Queue } from "bullmq";
import { ModuleRef } from "@nestjs/core";
import { Dictionary } from "lodash";
import { QUEUE_LIST } from "./health.module";

type QueueData = {
  waitingJobs: number;
  totalJobs: number;
};

@Injectable()
export class QueueHealthIndicator implements OnModuleInit {
  private queues: Queue[] = [];

  constructor(private readonly moduleRef: ModuleRef, private readonly healthIndicatorService: HealthIndicatorService) {}

  async isHealthy() {
    const indicator = this.healthIndicatorService.check("redis:bullmq");

    try {
      const data: Dictionary<QueueData> = {};
      for (const queue of this.queues) {
        data[queue.name] = await this.checkQueue(queue);
      }

      return indicator.up(data);
    } catch (error) {
      return indicator.down({ message: "Error fetching Airtable queue stats", error });
    }
  }

  onModuleInit() {
    const queueList = this.moduleRef.get(QUEUE_LIST) as string[];
    for (const name of queueList) {
      this.queues.push(this.moduleRef.get(getQueueToken(name), { strict: false }));
    }
  }

  private async checkQueue(queue: Queue) {
    const isHealthy = (await (await queue.client).ping()) === "PONG";
    if (!isHealthy) throw new Error("Redis connection for airtable queue unavailable");

    return {
      waitingJobs: await queue.getWaitingCount(),
      totalJobs: await queue.count()
    };
  }
}
