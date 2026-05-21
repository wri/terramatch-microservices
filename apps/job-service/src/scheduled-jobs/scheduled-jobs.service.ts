import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  Framework,
  FundingProgramme,
  Notification,
  PasswordReset,
  ScheduledJob,
  Verification
} from "@terramatch-microservices/database/entities";
import { ENTERPRISES, LANDSCAPES } from "@terramatch-microservices/database/constants";
import { Op, Transaction } from "sequelize";
import type { TaskDue } from "@terramatch-microservices/database/constants/scheduled-jobs";
import {
  REPORT_REMINDER,
  SITE_AND_NURSERY_REMINDER,
  TASK_DUE
} from "@terramatch-microservices/database/constants/scheduled-jobs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { DateTime } from "luxon";
import { REPORT_REMINDER_EVENT, SITE_AND_NURSERY_REMINDER_EVENT, TASK_DUE_EVENT } from "./scheduled-jobs.processor";
import { CACHED_EXPORT_ENTITY_TYPES } from "@terramatch-microservices/database/constants/entities";
import { isNotNull } from "@terramatch-microservices/database/types/array";

const VERIFICATION_RETENTION_HOURS = 48;
const PASSWORD_RESET_RETENTION_DAYS = 7;
const NOTIFICATION_RETENTION_DAYS = 90;

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new TMLogger(ScheduledJobsService.name);

  constructor(
    @InjectQueue("scheduled-jobs") private readonly scheduledJobsQueue: Queue,
    @InjectQueue("entities") private readonly entitiesQueue: Queue
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledJobs() {
    const transaction = await ScheduledJob.sql.transaction();
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

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "removeStaleVerifications" })
  async removeStaleVerifications() {
    const cutoff = DateTime.utc().minus({ hours: VERIFICATION_RETENTION_HOURS }).toJSDate();
    const removed = await Verification.destroy({
      where: { createdAt: { [Op.lte]: cutoff } }
    });
    if (removed > 0) {
      this.logger.log(`Removed ${removed} stale verifications (older than ${VERIFICATION_RETENTION_HOURS}h)`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "removeStalePasswordResets" })
  async removeStalePasswordResets() {
    const cutoff = DateTime.utc().minus({ days: PASSWORD_RESET_RETENTION_DAYS }).toJSDate();
    const removed = await PasswordReset.destroy({
      where: { createdAt: { [Op.lte]: cutoff } }
    });
    if (removed > 0) {
      this.logger.log(`Removed ${removed} stale password resets (older than ${PASSWORD_RESET_RETENTION_DAYS}d)`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "removeStaleNotifications" })
  async removeStaleNotifications() {
    const cutoff = DateTime.utc().minus({ days: NOTIFICATION_RETENTION_DAYS }).toJSDate();
    const removed = await Notification.destroy({
      where: {
        createdAt: { [Op.lte]: cutoff },
        unread: false
      }
    });
    if (removed > 0) {
      this.logger.log(`Removed ${removed} stale read notifications (older than ${NOTIFICATION_RETENTION_DAYS}d)`);
    }
  }

  @Cron("0 13,20 * * *", { name: "generateFrameworkEntityExports" })
  async generateFrameworkEntityExports() {
    const frameworks = (await Framework.findAll({ attributes: ["slug"] })).map(({ slug }) => slug).filter(isNotNull);
    for (const frameworkKey of frameworks) {
      for (const entityType of CACHED_EXPORT_ENTITY_TYPES) {
        await this.entitiesQueue.add("generateFrameworkEntityExport", { frameworkKey, entityType });
      }
    }
  }

  @Cron("0 13,20 * * *", { name: "generateApplicationExports" })
  async generateApplicationExports() {
    const ids = (await FundingProgramme.findAll({ attributes: ["id"] })).map(({ id }) => id as number);
    for (const fundingProgrammeId of ids) {
      await this.entitiesQueue.add("generateApplicationExport", { fundingProgrammeId });
    }
  }
}
