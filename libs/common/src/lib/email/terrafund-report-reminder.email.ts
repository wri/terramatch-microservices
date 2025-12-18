/* istanbul ignore file */
import { EmailService } from "./email.service";
import { Notification, Project, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { groupBy } from "lodash";
import { ProjectEmailSender } from "./project-email-sender";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { Queue } from "bullmq";

export class TerrafundReportReminderEmail extends ProjectEmailSender {
  override logger = new TMLogger(TerrafundReportReminderEmail.name);

  async sendLater(emailQueue: Queue) {
    await emailQueue.add("terrafundReportReminder", { projectIds: this.projectIds });
  }

  async sendForProject(projectId: number, users: User[], emailService: EmailService) {
    const project = await Project.findOne({ where: { id: projectId }, attributes: ["frameworkKey"] });
    if (project?.frameworkKey !== "terrafund") {
      this.logger.error(
        `Asked to send terrafund report reminder email for non-terrafund project [${projectId}, ${project?.frameworkKey}]`
      );
      return;
    }

    if (users.length === 0) {
      const notificationProps = {
        title: "Terrafund Report Reminder",
        body: "Terrafund reports are due in a month",
        action: "terrafund_report_reminder",
        referencedModel: "Project",
        referencedModelId: projectId,
        hiddenFromApp: true
      };
      await Notification.bulkCreate(users.map(({ id }) => ({ ...notificationProps, userId: id } as Notification)));
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
              transactional: "transactional",
              link: `/terrafund/programmeOverview/${projectId}`
            }
          }
        )
      )
    );
  }
}
