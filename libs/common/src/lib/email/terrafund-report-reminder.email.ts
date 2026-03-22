/* istanbul ignore file */
/**
 * Terrafund programme emails: scheduled report reminder (DB job), weekly incomplete-task digest,
 * and weekly polygon update digest (Laravel-migrated cron in job-service).
 */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import {
  Notification,
  PolygonUpdates,
  Project,
  ProjectUser,
  SitePolygon,
  Task,
  User
} from "@terramatch-microservices/database/entities";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { TMLogger } from "../util/tm-logger";
import { Dictionary, groupBy } from "lodash";
import { ProjectEmailSender } from "./project-email-sender";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { ProjectEmailData } from "./email.processor";
import { Op, col, fn } from "sequelize";
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

// --- Task digest (Laravel SendDailyDigestNotificationsJob / TaskDigestMail) ---

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

// --- Weekly polygon updates (Laravel send-weekly-polygon-update-notifications) ---

export type WeeklyPolygonUpdateEmailData = {
  sitePolygonUuids: string[];
};

const POLYGON_UPDATE_I18N: Dictionary<string> = {
  subject: "terrafund-polygon-update.subject",
  title: "terrafund-polygon-update.title",
  body: "terrafund-polygon-update.body",
  cta: "terrafund-polygon-update.cta"
};

const escapeHtml = (value: string | null | undefined): string => {
  if (value == null || value.length === 0) return "";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

export class WeeklyPolygonUpdateEmail extends EmailSender<WeeklyPolygonUpdateEmailData> {
  static readonly NAME = "weeklyPolygonUpdate";

  private readonly logger = new TMLogger(WeeklyPolygonUpdateEmail.name);

  constructor(data: WeeklyPolygonUpdateEmailData) {
    super(WeeklyPolygonUpdateEmail.NAME, data);
  }

  /** Distinct site_polygon_uuid values with at least one row since weekAgo. */
  static async loadRecentSitePolygonUuids(weekAgo: Date): Promise<string[]> {
    const rows = await PolygonUpdates.findAll({
      attributes: [[fn("DISTINCT", col("site_polygon_uuid")), "sitePolygonUuid"]],
      where: { createdAt: { [Op.gte]: weekAgo } },
      raw: true
    });
    return rows
      .map(r => (r as { sitePolygonUuid: string }).sitePolygonUuid)
      .filter((uuid): uuid is string => typeof uuid === "string" && uuid.length > 0);
  }

  async send(emailService: EmailService) {
    const weekAgo = DateTime.now().minus({ days: 7 }).toJSDate();
    for (const sitePolygonUuid of this.data.sitePolygonUuids) {
      await this.sendForPolygon(sitePolygonUuid, weekAgo, emailService);
    }
  }

  private async sendForPolygon(sitePolygonUuid: string, weekAgo: Date, emailService: EmailService) {
    const updates = await PolygonUpdates.findAll({
      where: {
        sitePolygonUuid,
        createdAt: { [Op.gte]: weekAgo }
      },
      order: [["createdAt", "ASC"]]
    });

    if (updates.length === 0) {
      this.logger.debug(`Polygon update email skipped: no rows in window [uuid=${sitePolygonUuid}]`);
      return;
    }

    const polygon = await SitePolygon.findOne({
      where: { uuid: sitePolygonUuid },
      include: [
        {
          association: "site",
          attributes: ["uuid", "name", "projectId"],
          required: true,
          include: [{ association: "project", attributes: ["id", "uuid", "name", "frameworkKey"], required: true }]
        }
      ]
    });

    if (polygon == null) {
      this.logger.debug(`Polygon update email skipped: site polygon not found [uuid=${sitePolygonUuid}]`);
      return;
    }

    const project = polygon.site?.project;
    if (project == null || project.frameworkKey !== "terrafund") {
      this.logger.debug(
        `Polygon update email skipped: missing site/project or not terrafund [uuid=${sitePolygonUuid}]`
      );
      return;
    }

    const projectUsers = await ProjectUser.findAll({
      where: {
        projectId: project.id,
        [Op.or]: [{ isManaging: true }, { isMonitoring: true }]
      },
      attributes: ["userId", "isManaging", "isMonitoring"]
    });

    if (projectUsers.length === 0) {
      this.logger.debug(`Polygon update email skipped: no recipients [uuid=${sitePolygonUuid}]`);
      return;
    }

    const userIds = [...new Set(projectUsers.map(pu => pu.userId))];
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds }, isSubscribed: true },
      attributes: ["id", "emailAddress", "locale"]
    });

    const recipients = emailService.filterEntityEmailRecipients(users);
    if (recipients.length === 0) {
      this.logger.debug(`Polygon update email skipped: filtered recipients [uuid=${sitePolygonUuid}]`);
      return;
    }

    const updateRows = updates.filter(u => u.type === "update");
    const statusRows = updates.filter(u => u.type === "status");

    const updatesTable =
      updateRows.length === 0
        ? ""
        : `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Version</th><th>Change</th><th>Comment</th></tr></thead><tbody>${updateRows
            .map(
              u =>
                `<tr><td>${escapeHtml(u.versionName)}</td><td>${escapeHtml(u.change)}</td><td>${escapeHtml(
                  u.comment
                )}</td></tr>`
            )
            .join("")}</tbody></table>`;

    const statusTable =
      statusRows.length === 0
        ? ""
        : `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Old status</th><th>New status</th><th>Comment</th></tr></thead><tbody>${statusRows
            .map(
              u =>
                `<tr><td>${escapeHtml(u.oldStatus)}</td><td>${escapeHtml(u.newStatus)}</td><td>${escapeHtml(
                  u.comment
                )}</td></tr>`
            )
            .join("")}</tbody></table>`;

    const baseUrl = emailService.getFrontEndUrl();
    const link = `${baseUrl}/terrafund/programmeOverview/${project.id}`;

    const i18nReplacements: Dictionary<string> = {
      "{projectName}": project.name ?? "",
      "{polygonName}": polygon.polyName ?? sitePolygonUuid,
      "{updatesTable}": updatesTable,
      "{statusTable}": statusTable
    };

    await Promise.all(
      Object.entries(groupBy(recipients, "locale")).map(([locale, localeUsers]) =>
        emailService.sendI18nTemplateEmail(
          localeUsers.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          POLYGON_UPDATE_I18N,
          {
            i18nReplacements,
            additionalValues: {
              transactional: "transactional",
              link,
              monitoring: "monitoring"
            }
          }
        )
      )
    );
  }
}
