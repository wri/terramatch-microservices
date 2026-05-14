/* istanbul ignore file */
/**
 * Weekly polygon update digest email (Terrafund, enqueued from job-service cron).
 */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { PolygonUpdates, ProjectUser, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Dictionary, groupBy } from "lodash";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { Op, col, fn } from "sequelize";
import { DateTime } from "luxon";

export type WeeklyPolygonUpdateEmailData = {
  sitePolygonUuids: string[];
};

const POLYGON_UPDATE_I18N: Dictionary<string> = {
  subject: "terrafund-polygon-update.subject",
  title: "terrafund-polygon-update.title",
  body: "terrafund-polygon-update.body",
  cta: "terrafund-polygon-update.cta"
};

const escapeHtmlPolygonUpdate = (value: string | null | undefined): string => {
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
                `<tr><td>${escapeHtmlPolygonUpdate(u.versionName)}</td><td>${escapeHtmlPolygonUpdate(
                  u.change
                )}</td><td>${escapeHtmlPolygonUpdate(u.comment)}</td></tr>`
            )
            .join("")}</tbody></table>`;

    const statusTable =
      statusRows.length === 0
        ? ""
        : `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Old status</th><th>New status</th><th>Comment</th></tr></thead><tbody>${statusRows
            .map(
              u =>
                `<tr><td>${escapeHtmlPolygonUpdate(u.oldStatus)}</td><td>${escapeHtmlPolygonUpdate(
                  u.newStatus
                )}</td><td>${escapeHtmlPolygonUpdate(u.comment)}</td></tr>`
            )
            .join("")}</tbody></table>`;

    const link = `${emailService.frontEndUrl}/terrafund/programmeOverview/${project.id}`;

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
