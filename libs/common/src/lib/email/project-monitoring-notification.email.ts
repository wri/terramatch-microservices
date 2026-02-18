import { Dictionary } from "lodash";
import { TMLogger } from "../util/tm-logger";
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Project, User } from "@terramatch-microservices/database/entities";

type ProjectMonitoringNotificationEmailData = {
  projectId: number;
  userId: number;
  token: string;
};

const EMAIL_PROJECT_MONITORING_NOTIFICATION_KEYS = {
  body: "v2-project-monitoring-notification.body",
  subjectKey: "v2-project-monitoring-notification.subject",
  titleKey: "v2-project-monitoring-notification.title"
} as const;

export class ProjectMonitoringNotificationEmail extends EmailSender<ProjectMonitoringNotificationEmailData> {
  static readonly NAME = "projectMonitoringNotification";

  private readonly logger = new TMLogger(ProjectMonitoringNotificationEmail.name);

  constructor(data: ProjectMonitoringNotificationEmailData) {
    super(ProjectMonitoringNotificationEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({
      where: { id: this.data.userId },
      attributes: ["id", "emailAddress", "locale"]
    });
    if (user == null) {
      this.logger.error(`User not found [${this.data.userId}]`);
      return;
    }
    if (user.emailAddress == null) {
      this.logger.error(`User has no email address [${this.data.userId}]`);
      return;
    }
    const project = await Project.findOne({
      where: { id: this.data.projectId },
      attributes: ["name"]
    });
    if (project == null) {
      this.logger.error(`Project not found [${this.data.projectId}]`);
      return;
    }
    const i18nReplacements: Dictionary<string> = {
      "{name}": project.name as string,
      "{callbackUrl}": `/reset-password/${this.data.token}`
    };
    const additionalValues = {
      link: `/reset-password/${this.data.token}`,
      transactional: "transactional"
    };
    await emailService.sendI18nTemplateEmail(
      user.emailAddress,
      user.locale,
      EMAIL_PROJECT_MONITORING_NOTIFICATION_KEYS,
      { i18nReplacements, additionalValues }
    );

    await emailService.sendI18nTemplateEmail(
      user.emailAddress,
      user.locale,
      EMAIL_PROJECT_MONITORING_NOTIFICATION_KEYS,
      { i18nReplacements, additionalValues }
    );
  }
}
