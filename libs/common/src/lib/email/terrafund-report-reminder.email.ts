import { EmailSender } from "./email-sender";
import { TerrafundReportReminderEmailData } from "./email.processor";
import { EmailService } from "./email.service";
import { Notification, Project, ProjectUser, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Op } from "sequelize";
import { groupBy } from "lodash";

export class TerrafundReportReminderEmail extends EmailSender {
  private readonly logger = new TMLogger(TerrafundReportReminderEmail.name);

  private readonly projectIds: number[];

  constructor({ projectIds }: TerrafundReportReminderEmailData) {
    super();
    this.projectIds = projectIds;
  }

  async send(emailService: EmailService) {
    const results = await Promise.allSettled(
      this.projectIds.map(projectId => this.sendForProject(projectId, emailService))
    );

    const failed = results.filter(({ status }) => status === "rejected");
    if (failed.length > 0) {
      this.logger.error(`Failed to send terrafund report reminder emails: ${JSON.stringify(failed)}`);
    }
  }

  async sendForProject(projectId: number, emailService: EmailService) {
    const project = await Project.findOne({ where: { id: projectId }, attributes: ["frameworkKey"] });
    if (project?.frameworkKey !== "terrafund") {
      this.logger.error(
        `Asked to send terrafund report reminder email for non-terrafund project [${projectId}, ${project?.frameworkKey}]`
      );
      return;
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
      attributes: ["emailAddress", "locale"]
    });
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
          locale,
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
