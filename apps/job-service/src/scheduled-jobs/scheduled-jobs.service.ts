import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ScheduledJob, Task } from "@terramatch-microservices/database/entities";
import { ENTERPRISES, LANDSCAPES } from "@terramatch-microservices/database/constants";
import { AWAITING_APPROVAL, APPROVED } from "@terramatch-microservices/database/constants/status";
import { Op, QueryTypes, Transaction } from "sequelize";
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
import { TaskDigestEmail } from "@terramatch-microservices/common/email/terrafund-report-reminder.email";
import { WeeklyPolygonUpdateEmail } from "@terramatch-microservices/common/email/weekly-polygon-update.email";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

const TASK_DIGEST_CHUNK_SIZE = 100;
const POLYGON_DIGEST_CHUNK_SIZE = 50;

/** MySQL/MariaDB named locks so only one job-service replica runs each weekly cron at a time. */
const MYSQL_LOCK_TASK_DIGEST_WEEKLY = "tm_job_svc_task_digest_wk";
const MYSQL_LOCK_POLYGON_UPDATES_WEEKLY = "tm_job_svc_polygon_update_wk";

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
   * Weekly incomplete-task digest. Uses a MySQL named lock so only one replica enqueues when
   * multiple job-service instances are deployed.
   */
  @Cron("0 17 * * 1", { name: "taskDigestWeekly" })
  async enqueueTaskDigestEmails(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await Task.sequelize!.transaction(async transaction => {
      await this.runWithMysqlNamedLock(MYSQL_LOCK_TASK_DIGEST_WEEKLY, transaction, async () => {
        this.logger.log("Enqueueing task digest email jobs (incomplete tasks)");
        let total = 0;
        const builder = new PaginatedQueryBuilder(Task, TASK_DIGEST_CHUNK_SIZE).attributes(["id"]).where({
          status: { [Op.notIn]: [AWAITING_APPROVAL, APPROVED] }
        });
        for await (const page of batchFindAll(builder)) {
          const taskIds = page.map(({ id }) => id);
          total += taskIds.length;
          await new TaskDigestEmail({ taskIds }).sendLater(this.emailQueue);
        }
        this.logger.log(`Task digest: enqueued chunks covering up to ${total} incomplete tasks`);
      });
    });
  }

  /**
   * Weekly polygon update digest. Uses a MySQL named lock so only one replica enqueues when
   * multiple job-service instances are deployed.
   */
  @Cron("0 0 * * 1", { name: "weeklyPolygonUpdates" })
  async enqueueWeeklyPolygonUpdateEmails(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await Task.sequelize!.transaction(async transaction => {
      await this.runWithMysqlNamedLock(MYSQL_LOCK_POLYGON_UPDATES_WEEKLY, transaction, async () => {
        this.logger.log("Enqueueing weekly polygon update email jobs");
        const weekAgo = DateTime.now().minus({ days: 7 }).toJSDate();
        const uuids = await WeeklyPolygonUpdateEmail.loadRecentSitePolygonUuids(weekAgo);
        for (let i = 0; i < uuids.length; i += POLYGON_DIGEST_CHUNK_SIZE) {
          const sitePolygonUuids = uuids.slice(i, i + POLYGON_DIGEST_CHUNK_SIZE);
          await new WeeklyPolygonUpdateEmail({ sitePolygonUuids }).sendLater(this.emailQueue);
        }
        this.logger.log(`Weekly polygon updates: enqueued ${uuids.length} UUIDs in chunks`);
      });
    });
  }

  /**
   * Runs `fn` while holding a MySQL/MariaDB named lock on the current transaction connection.
   * If the lock is not acquired (another node holds it), `fn` is skipped.
   */
  private async runWithMysqlNamedLock(
    lockName: string,
    transaction: Transaction,
    fn: () => Promise<void>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sequelize = Task.sequelize!;
    const rows = await sequelize.query<{ got: number }>("SELECT GET_LOCK(:name, 0) AS got", {
      replacements: { name: lockName },
      transaction,
      type: QueryTypes.SELECT
    });
    const first = rows[0];
    if (first == null || Number(first.got) !== 1) {
      this.logger.debug(`Cron skipped: could not acquire named lock [${lockName}]`);
      return;
    }
    try {
      await fn();
    } finally {
      await sequelize.query("SELECT RELEASE_LOCK(:name) AS rel", {
        replacements: { name: lockName },
        transaction,
        type: QueryTypes.SELECT
      });
    }
  }
}
