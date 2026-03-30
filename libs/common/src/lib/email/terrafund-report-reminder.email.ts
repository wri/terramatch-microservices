/* istanbul ignore file */
/**
 * Terrafund programme emails: scheduled report reminder (DB job) and weekly incomplete-task digest (job-service cron).
 */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Notification, Project, ProjectUser, Task, User } from "@terramatch-microservices/database/entities";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { TMLogger } from "../util/tm-logger";
import { Dictionary, groupBy } from "lodash";
import { ProjectEmailSender } from "./project-email-sender";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { ProjectEmailData } from "./email.processor";
import { Op } from "sequelize";
import { DateTime } from "luxon";

export class TerrafundReportReminderEmail extends ProjectEmailSender {
  static readonly NAME = "terrafundReportReminder";

  constructor(data: ProjectEmailData) {
    super(TerrafundReportReminderEmail.NAME, data);
  }

  override logger = new TMLogger(TerrafundReportReminderEmail.name);

  async sendForProject(projectId: number, users: User[], emailService: EmailService) {
    const project = await Project.findOne({ where: { id: projectId }, attributes: ["frameworkKey"] });
    if (project?.frameworkKey !== "terrafund") {
      this.logger.error(
        `Asked to send terrafund report reminder email for non-terrafund project [${projectId}, ${project?.frameworkKey}]`
      );
      return;
    }

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
              transactional: "transactional",
              link: `/terrafund/programmeOverview/${projectId}`
            }
          }
        )
      )
    );
  }
}

export type TaskDigestEmailData = {
  taskIds: number[];
};

const TASK_DIGEST_I18N: Dictionary<string> = {
  subject: "task-digest.subject",
  title: "task-digest.title",
  body: "task-digest.body",
  cta: "task-digest.cta"
};

export class TaskDigestEmail extends EmailSender<TaskDigestEmailData> {
  static readonly NAME = "taskDigest";

  private readonly logger = new TMLogger(TaskDigestEmail.name);

  constructor(data: TaskDigestEmailData) {
    super(TaskDigestEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    for (const taskId of this.data.taskIds) {
      await this.sendForTask(taskId, emailService);
    }
  }

  private async sendForTask(taskId: number, emailService: EmailService) {
    const task = await Task.findByPk(taskId, {
      include: [
        { association: "project", attributes: ["id", "uuid", "name", "frameworkKey"] },
        { association: "projectReport", attributes: ["status"], required: false },
        { association: "siteReports", attributes: ["status"], required: false },
        { association: "nurseryReports", attributes: ["status"], required: false },
        { association: "srpReports", attributes: ["status"], required: false }
      ]
    });

    if (task?.project == null || task.projectId == null) {
      this.logger.debug(`Task digest skipped: missing project [taskId=${taskId}]`);
      return;
    }

    const reports = [
      task.projectReport,
      ...(task.siteReports ?? []),
      ...(task.nurseryReports ?? []),
      ...(task.srpReports ?? [])
    ].filter((r): r is NonNullable<typeof r> => r != null);

    if (reports.length === 0) {
      this.logger.debug(`Task digest skipped: no linked reports [taskId=${taskId}]`);
      return;
    }

    if (reports.every(r => r.status === APPROVED)) {
      this.logger.debug(`Task digest skipped: all reports approved [taskId=${taskId}]`);
      return;
    }

    const now = DateTime.now().setZone("Europe/Sofia");
    const dueAt = DateTime.fromJSDate(task.dueAt).setZone("Europe/Sofia");
    const oneWeekBeforeDue = dueAt.minus({ weeks: 1 });
    const withinDigestWindow = now >= oneWeekBeforeDue || now > dueAt;
    if (!withinDigestWindow) {
      this.logger.debug(`Task digest skipped: outside due window [taskId=${taskId}]`);
      return;
    }

    const projectUsers = await ProjectUser.findAll({
      where: {
        projectId: task.projectId,
        [Op.or]: [{ isManaging: true }, { isMonitoring: true }]
      },
      attributes: ["userId", "isManaging", "isMonitoring"]
    });

    if (projectUsers.length === 0) {
      this.logger.debug(`Task digest skipped: no managers or monitors [taskId=${taskId}]`);
      return;
    }

    const userIds = [...new Set(projectUsers.map(pu => pu.userId))];
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds }, isSubscribed: true },
      attributes: ["id", "emailAddress", "locale"]
    });

    const recipients = emailService.filterEntityEmailRecipients(users);
    if (recipients.length === 0) {
      this.logger.debug(`Task digest skipped: no recipients after filters [taskId=${taskId}]`);
      return;
    }

    const managingIds = new Set(projectUsers.filter(pu => pu.isManaging).map(pu => pu.userId));
    const monitoringIds = new Set(projectUsers.filter(pu => pu.isMonitoring).map(pu => pu.userId));

    const baseUrl = emailService.getFrontEndUrl();
    const managerTaskLink = `${baseUrl}/admin#/task/${task.uuid}/show`;
    const pdTaskLink = `${baseUrl}/project/${task.project.uuid}/reporting-task/${task.uuid}`;

    const projectName = task.project.name ?? "";
    const dueDateFormatted = dueAt.toLocaleString(DateTime.DATE_MED);

    const i18nReplacements: Dictionary<string> = {
      "{projectName}": projectName,
      "{dueDate}": dueDateFormatted,
      "{periodKey}": task.periodKey ?? ""
    };

    const managers = recipients.filter(u => managingIds.has(u.id));
    const monitorsOnly = recipients.filter(u => monitoringIds.has(u.id) && !managingIds.has(u.id));

    await Promise.all([
      ...Object.entries(groupBy(managers, "locale")).map(([locale, localeUsers]) =>
        emailService.sendI18nTemplateEmail(
          localeUsers.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          TASK_DIGEST_I18N,
          {
            i18nReplacements,
            additionalValues: {
              transactional: "transactional",
              link: managerTaskLink,
              monitoring: "monitoring"
            }
          }
        )
      ),
      ...Object.entries(groupBy(monitorsOnly, "locale")).map(([locale, localeUsers]) =>
        emailService.sendI18nTemplateEmail(
          localeUsers.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          TASK_DIGEST_I18N,
          {
            i18nReplacements,
            additionalValues: {
              transactional: "transactional",
              link: pdTaskLink,
              monitoring: "monitoring"
            }
          }
        )
      )
    ]);
  }
}
