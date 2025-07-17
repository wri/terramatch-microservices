import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Job, Queue } from "bullmq";
import { Nursery, Project, ScheduledJob, Site } from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Op } from "sequelize";
import { ReportGenerationService } from "@terramatch-microservices/common/tasks/report-generation-service";
import { DateTime } from "luxon";
import {
  ReportReminder,
  ScheduledJobPayload,
  SiteAndNurseryReminder,
  TaskDue
} from "@terramatch-microservices/database/constants/scheduled-jobs";

export const TASK_DUE_EVENT = "taskDue" as const;
export const REPORT_REMINDER_EVENT = "reportReminder" as const;
export const SITE_AND_NURSERY_REMINDER_EVENT = "siteAndNurseryReminder" as const;

type ScheduledJobData = { id: number; taskDefinition: ScheduledJobPayload };

@Processor("scheduled-jobs")
export class ScheduledJobsProcessor extends WorkerHost {
  private readonly logger = new TMLogger(ScheduledJobsProcessor.name);

  constructor(
    @InjectQueue("email") private readonly emailQueue: Queue,
    private readonly reportGenerationService: ReportGenerationService
  ) {
    super();
  }

  async process({ name, data: { id, taskDefinition } }: Job<ScheduledJobData>) {
    try {
      switch (name) {
        case TASK_DUE_EVENT:
          await this.processTaskDue(taskDefinition as TaskDue);
          break;

        case REPORT_REMINDER_EVENT:
          await this.processReportReminder(taskDefinition as ReportReminder);
          break;

        case SITE_AND_NURSERY_REMINDER_EVENT:
          await this.processSiteAndNurseryReminder(taskDefinition as SiteAndNurseryReminder);
          break;

        default:
          this.logger.error(`Unrecognized job type: ${name}`, taskDefinition);
      }
    } catch (error) {
      this.logger.error("Error processing job", error);
      // Allow the job to try again. If we see this causing non-stop errors, we'll want to add a
      // feature for limited retries.
      await ScheduledJob.restore({ where: { id } });
    }
  }

  private async processTaskDue(taskDue: TaskDue) {
    this.logger.log(`processTaskDue ${JSON.stringify(taskDue)}`);
    const { frameworkKey, dueAt: dueAtString } = taskDue;
    const where = { frameworkKey, status: { [Op.ne]: "started" } };
    const count = await Project.count({ where });
    const dueAt = DateTime.fromISO(dueAtString).toJSDate();
    const failed: PromiseSettledResult<void>[] = [];
    for (let ii = 0; ii < count; ii += 100) {
      const projects = await Project.findAll({ where, limit: 100, offset: ii, attributes: ["id"] });
      failed.push(
        ...(
          await Promise.allSettled(projects.map(({ id }) => this.reportGenerationService.createTask(id, dueAt)))
        ).filter(({ status }) => status === "rejected")
      );
    }

    if (failed.length > 0) {
      this.logger.error(`Failed to create task for some projects: ${JSON.stringify(failed)}`);
    }
  }

  private async processReportReminder(reportReminder: ReportReminder) {
    this.logger.log(`processReportReminder ${JSON.stringify(reportReminder)}`);
    const { frameworkKey } = reportReminder;
    if (frameworkKey !== "terrafund") {
      this.logger.warn(`Report reminder for framework other than terrafund: ${frameworkKey}, ignoring`);
      return;
    }

    const projectIds = (
      await Project.findAll({
        where: {
          frameworkKey,
          [Op.or]: [
            { id: { [Op.in]: Subquery.select(Site, "projectId").literal } },
            { id: { [Op.in]: Subquery.select(Nursery, "projectId").literal } }
          ]
        },
        attributes: ["id"]
      })
    ).map(({ id }) => id);

    await this.emailQueue.add("terrafundReportReminder", { projectIds });
  }

  private async processSiteAndNurseryReminder(siteAndNurseryReminder: SiteAndNurseryReminder) {
    this.logger.log(`processSiteAndNurseryReminder ${JSON.stringify(siteAndNurseryReminder)}`);
    const { frameworkKey } = siteAndNurseryReminder;
    if (frameworkKey !== "terrafund") {
      this.logger.warn(`Site and Nursery reminder for framework other than terrafund: ${frameworkKey}, ignoring`);
      return;
    }

    const projectIds = (
      await Project.findAll({
        where: {
          frameworkKey,
          [Op.and]: [
            { id: { [Op.notIn]: Subquery.select(Site, "projectId").literal } },
            { id: { [Op.notIn]: Subquery.select(Nursery, "projectId").literal } }
          ]
        }
      })
    ).map(({ id }) => id);

    await this.emailQueue.add("terrafundSiteAndNurseryReminder", { projectIds });
  }
}
