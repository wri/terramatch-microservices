import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ScheduledJob, Task } from "@terramatch-microservices/database/entities";
import { ENTERPRISES, LANDSCAPES } from "@terramatch-microservices/database/constants";
import { AWAITING_APPROVAL, APPROVED } from "@terramatch-microservices/database/constants/status";
import { Op, Transaction } from "sequelize";
import {
  REPORT_REMINDER,
  SITE_AND_NURSERY_REMINDER,
  TASK_DUE
} from "@terramatch-microservices/database/constants/scheduled-jobs";
import type { TaskDue } from "@terramatch-microservices/database/constants/scheduled-jobs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { DateTime } from "luxon";
import { REPORT_REMINDER_EVENT, SITE_AND_NURSERY_REMINDER_EVENT, TASK_DUE_EVENT } from "./scheduled-jobs.processor";
import {
  TaskDigestEmail,
  WeeklyPolygonUpdateEmail
} from "@terramatch-microservices/common/email/terrafund-report-reminder.email";

const TASK_DIGEST_CHUNK_SIZE = 100;
const POLYGON_DIGEST_CHUNK_SIZE = 50;

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new TMLogger(ScheduledJobsService.name);

  constructor(
    @InjectQueue("scheduled-jobs") private readonly scheduledJobsQueue: Queue,
    @InjectQueue("email") private readonly emailQueue: Queue
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledJobs() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const transaction = await ScheduledJob.sequelize!.transaction();
    try {
      const jobs = await ScheduledJob.findAll({
        where: { executionTime: { [Op.lte]: new Date() } },
        // Use an update row lock on this query so that if multiple nodes happen to trigger this
        // cron job at the exact same instant, only one of them gets access to the jobs that are
        // ready to process.
        lock: transaction.LOCK.UPDATE,
        skipLocked: true,
        transaction
      });

      for (const job of jobs) {
        await this.processJob(job, transaction);
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  private async processJob(job: ScheduledJob, transaction: Transaction) {
    // Remove the job first so that it doesn't get picked up again. We will undelete in the processor
    // if there's an error
    await job.destroy({ transaction });
    const { id, type, taskDefinition } = job;
    this.logger.log(`Adding job to the queue: [${type}, ${JSON.stringify(taskDefinition)}]`);
    switch (job.type) {
      case TASK_DUE:
        await this.scheduledJobsQueue.add(TASK_DUE_EVENT, { id, taskDefinition });
        break;

      case REPORT_REMINDER:
        await this.scheduledJobsQueue.add(REPORT_REMINDER_EVENT, { id, taskDefinition });
        break;

      case SITE_AND_NURSERY_REMINDER:
        await this.scheduledJobsQueue.add(SITE_AND_NURSERY_REMINDER_EVENT, { id, taskDefinition });
        break;

      default:
        this.logger.error(`Unrecognized job type: ${job.type}`, job);
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async ensureAnnualTaskDueJobs() {
    const now = DateTime.utc();
    const currentYear = now.year;
    const years = [currentYear, currentYear + 1] as const;

    const existing = await ScheduledJob.taskDue([LANDSCAPES, ENTERPRISES]).findAll({
      where: { executionTime: { [Op.gte]: DateTime.utc(currentYear, 1, 1).toJSDate() } },
      attributes: ["taskDefinition"]
    });
    const existingKeys = new Set(
      (existing as { taskDefinition: TaskDue }[])
        .filter(j => j.taskDefinition != null && "dueAt" in j.taskDefinition)
        .map(j => `${(j.taskDefinition as TaskDue).frameworkKey}|${(j.taskDefinition as TaskDue).dueAt}`)
    );

    for (const framework of [LANDSCAPES, ENTERPRISES]) {
      for (const year of years) {
        const month = 1;
        const day = 31;
        const dueAt = DateTime.utc(year, month, day);
        if (dueAt < now) continue;
        const dueAtISO = dueAt.toISO();
        const key = `${framework}|${dueAtISO}`;
        if (existingKeys.has(key)) continue;
        const executionTime = DateTime.utc(year, month, 1).toJSDate();
        await ScheduledJob.scheduleTaskDue(executionTime, framework, dueAt.toJSDate());
        existingKeys.add(key);
        this.logger.log(`Scheduled TaskDue ${framework} dueAt ${dueAtISO}`);
      }
    }
  }

  /**
   * Laravel send-daily-digest-notifications: Monday 17:00 Europe/Sofia.
   * Multiple job-service replicas may each fire this cron; use a single replica or a distributed
   * lock if duplicate enqueues must be avoided (Laravel onOneServer).
   */
  @Cron("0 17 * * 1", { name: "taskDigestWeekly", timeZone: "Europe/Sofia" })
  async enqueueTaskDigestEmails(): Promise<void> {
    this.logger.log("Enqueueing task digest email jobs (incomplete tasks)");
    let cursor = 0;
    let total = 0;
    let hasMore = true;
    while (hasMore) {
      const tasks = await Task.findAll({
        where: {
          id: { [Op.gt]: cursor },
          status: { [Op.notIn]: [AWAITING_APPROVAL, APPROVED] }
        },
        attributes: ["id"],
        order: [["id", "ASC"]],
        limit: TASK_DIGEST_CHUNK_SIZE
      });
      if (tasks.length === 0) {
        hasMore = false;
        continue;
      }
      cursor = tasks[tasks.length - 1].id;
      const taskIds = tasks.map(({ id }) => id);
      total += taskIds.length;
      await this.emailQueue.add(TaskDigestEmail.NAME, { taskIds });
    }
    this.logger.log(`Task digest: enqueued chunks covering up to ${total} incomplete tasks`);
  }

  /** Laravel send-weekly-polygon-update-notifications: Monday 00:00 Europe/Sofia. */
  @Cron("0 0 * * 1", { name: "weeklyPolygonUpdates", timeZone: "Europe/Sofia" })
  async enqueueWeeklyPolygonUpdateEmails(): Promise<void> {
    this.logger.log("Enqueueing weekly polygon update email jobs");
    const weekAgo = DateTime.now().minus({ days: 7 }).toJSDate();
    const uuids = await WeeklyPolygonUpdateEmail.loadRecentSitePolygonUuids(weekAgo);
    for (let i = 0; i < uuids.length; i += POLYGON_DIGEST_CHUNK_SIZE) {
      const sitePolygonUuids = uuids.slice(i, i + POLYGON_DIGEST_CHUNK_SIZE);
      await this.emailQueue.add(WeeklyPolygonUpdateEmail.NAME, { sitePolygonUuids });
    }
    this.logger.log(`Weekly polygon updates: enqueued ${uuids.length} UUIDs in chunks`);
  }
}
