import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Job, Queue } from "bullmq";
import { Nursery, Project, ScheduledJob, Site } from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Op } from "sequelize";
import { ReportGenerationService } from "@terramatch-microservices/common/tasks/report-generation-service";
import { DateTime } from "luxon";

export const TASK_DUE_EVENT = "taskDue" as const;
type TaskDue = {
  framework_key: string;
  due_at: string;
};

export const REPORT_REMINDER_EVENT = "reportReminder" as const;
type ReportReminder = {
  framework_key: string;
};

export const SITE_AND_NURSERY_REMINDER_EVENT = "siteAndNurseryReminder" as const;
type SiteAndNurseryReminder = {
  framework_key: string;
};

@Processor("scheduled-jobs")
export class ScheduledJobsProcessor extends WorkerHost {
  private readonly logger = new TMLogger(ScheduledJobsProcessor.name);

  constructor(
    @InjectQueue("email") private readonly emailQueue: Queue,
    private readonly reportGenerationService: ReportGenerationService
  ) {
    super();
  }

  async process({ name, data: { id, taskDefinition } }: Job) {
    try {
      switch (name) {
        case TASK_DUE_EVENT:
          await this.processTaskDue(taskDefinition);
          break;

        case REPORT_REMINDER_EVENT:
          await this.processReportReminder(taskDefinition);
          break;

        case SITE_AND_NURSERY_REMINDER_EVENT:
          await this.processSiteAndNurseryReminder(taskDefinition);
          break;

        default:
          this.logger.error(`Unrecognised job type: ${name}`, taskDefinition);
      }
    } catch (error) {
      this.logger.error("Error processing job", error);
      // Allow the job to try again. If we see this causing non-stop errors, we'll want to add a
      // feature for limited retries.
      await ScheduledJob.restore({ where: { id } });
    }
  }

  private async processTaskDue({ framework_key: frameworkKey, due_at: dueAtString }: TaskDue) {
    const where = { frameworkKey, status: { [Op.ne]: "started" } };
    const count = await Project.count({ where });
    const dueAt = DateTime.fromISO(dueAtString).toJSDate();
    for (let ii = 0; ii < count; ii += 100) {
      const projects = await Project.findAll({ where, limit: 100, offset: ii, attributes: ["id"] });
      await Promise.allSettled(projects.map(({ id }) => this.reportGenerationService.createTask(id, dueAt)));
    }
  }

  private async processReportReminder({ framework_key: frameworkKey }: ReportReminder) {
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

  private async processSiteAndNurseryReminder({ framework_key: frameworkKey }: SiteAndNurseryReminder) {
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
