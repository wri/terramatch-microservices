/* istanbul ignore file */
/**
 * Terrafund programme emails: scheduled report reminder (DB job) and weekly incomplete-task digest (job-service cron).
 */
import { EmailService } from "./email.service";
import { Notification, Project, Task, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Dictionary, groupBy } from "lodash";
import { ProjectEmailSender } from "./project-email-sender";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { ProjectEmailData } from "./email.processor";
import { FRAMEWORK_KEYS_TF_REPORT_REMINDER, TERRAFUND } from "@terramatch-microservices/database/constants";
import { DateTime } from "luxon";

export class TerrafundReportReminderEmail extends ProjectEmailSender {
  static readonly NAME = "terrafundReportReminder";

  constructor(data: ProjectEmailData) {
    super(TerrafundReportReminderEmail.NAME, data);
  }

  override logger = new TMLogger(TerrafundReportReminderEmail.name);

  async sendForProject(projectId: number, users: User[], emailService: EmailService) {
    const project = await Project.findOne({ where: { id: projectId }, attributes: ["frameworkKey", "uuid", "name"] });
    if (project?.frameworkKey == null) {
      this.logger.error(`Project not found for terrafund report reminder [projectId=${projectId}]`);
      return;
    }

    const isTop100 = project.frameworkKey === TERRAFUND;
    const isTfReportReminderFramework = (FRAMEWORK_KEYS_TF_REPORT_REMINDER as readonly string[]).includes(
      project.frameworkKey
    );
    if (!isTop100 && !isTfReportReminderFramework) {
      this.logger.error(
        `Asked to send terrafund report reminder email for unsupported framework [${projectId}, ${project.frameworkKey}]`
      );
      return;
    }

    if (isTfReportReminderFramework) {
      if (this.data.dueAt == null) {
        this.logger.error(`Missing dueAt for terrafund report reminder [projectId=${projectId}]`);
        return;
      }

      const dueAt = DateTime.fromISO(this.data.dueAt, { zone: "utc" });
      const task = await Task.forProject(projectId).findOne({
        where: { dueAt: dueAt.toJSDate() },
        attributes: ["uuid"]
      });
      if (task == null) {
        this.logger.warn(
          `No task found for terrafund report reminder [projectId=${projectId}, dueAt=${this.data.dueAt}]`
        );
        return;
      }

      const projectName = project.name ?? "";
      const dueDateFormatted = dueAt.toLocaleString(DateTime.DATE_MED);
      const i18nReplacements: Dictionary<string> = {
        "{projectName}": projectName,
        "{dueDate}": dueDateFormatted
      };

      if (users.length !== 0) {
        const notificationProps = {
          title: "Terrafund Report Reminder",
          body: `Your report for ${projectName} is due on ${dueDateFormatted}`,
          action: "terrafund_report_reminder",
          referencedModel: "Project",
          referencedModelId: projectId,
          hiddenFromApp: true
        };
        await Notification.bulkCreate(users.map(({ id }) => ({ ...notificationProps, userId: id })));
      }

      await Promise.all(
        Object.entries(groupBy(users, "locale")).map(([locale, localeGroup]) =>
          emailService.sendI18nTemplateEmail(
            localeGroup.map(({ emailAddress }) => emailAddress),
            locale as ValidLocale,
            {
              title: "terrafund-report-reminder.title",
              subject: "terrafund-report-reminder.subject",
              body: "terrafund-report-reminder.body",
              cta: "terrafund-report-reminder.cta"
            },
            {
              i18nReplacements,
              additionalValues: {
                link: `/project/${project.uuid}/reporting-task/${task.uuid}`
              }
            }
          )
        )
      );
      return;
    }

    // Legacy Top 100 behaviour — unchanged
    if (users.length !== 0) {
      const notificationProps = {
        title: "Terrafund Report Reminder",
        body: "Terrafund reports are due in a month",
        action: "terrafund_report_reminder",
        referencedModel: "Project",
        referencedModelId: projectId,
        hiddenFromApp: true
      };
      await Notification.bulkCreate(users.map(({ id }) => ({ ...notificationProps, userId: id })));
    }

    await Promise.all(
      Object.entries(groupBy(users, "locale")).map(([locale, localeGroup]) =>
        emailService.sendI18nTemplateEmail(
          localeGroup.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          {
            title: "terrafund-report-reminder.title",
            subject: "terrafund-report-reminder.subject",
            body: "terrafund-report-reminder.body",
            cta: "terrafund-report-reminder.cta"
          },
          {
            additionalValues: {
              link: `/terrafund/programmeOverview/${projectId}`
            }
          }
        )
      )
    );
  }
}
