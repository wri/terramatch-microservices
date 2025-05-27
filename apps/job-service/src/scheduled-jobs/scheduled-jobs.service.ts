import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ScheduledJob } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import {
  REPORT_REMINDER,
  SITE_AND_NURSERY_REMINDER,
  TASK_DUE
} from "@terramatch-microservices/database/constants/scheduled-jobs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { REPORT_REMINDER_EVENT, SITE_AND_NURSERY_REMINDER_EVENT, TASK_DUE_EVENT } from "./scheduled-jobs.processor";

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new TMLogger(ScheduledJobsService.name);

  constructor(@InjectQueue("scheduled-jobs") private readonly scheduledJobsQueue: Queue) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledJobs() {
    const jobs = await ScheduledJob.findAll({
      where: { executionTime: { [Op.lte]: new Date() } }
    });

    for (const job of jobs) {
      await this.processJob(job);
    }
  }

  private async processJob(job: ScheduledJob) {
    // Remove the job first so that it doesn't get picked up again. We will undelete in the processor
    // if there's an error
    await job.destroy();
    const { id, type, taskDefinition } = job;
    this.logger.log(`Adding job to the queue: [${type}, ${JSON.stringify(taskDefinition)}]`);
    switch (job.type) {
      case TASK_DUE:
        await this.scheduledJobsQueue.add(TASK_DUE_EVENT, { jobId: id, taskDefinition });
        break;

      case REPORT_REMINDER:
        await this.scheduledJobsQueue.add(REPORT_REMINDER_EVENT, { jobId: id, taskDefinition });
        break;

      case SITE_AND_NURSERY_REMINDER:
        await this.scheduledJobsQueue.add(SITE_AND_NURSERY_REMINDER_EVENT, { jobId: id, taskDefinition });
        break;

      default:
        this.logger.error(`Unrecognized job type: ${job.type}`, job);
    }
  }
}
