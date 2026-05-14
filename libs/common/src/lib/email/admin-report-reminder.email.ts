/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { AdminReminderEmailData } from "./email.processor";
import { ENTITY_MODELS } from "@terramatch-microservices/database/constants/entities";
import {
  NurseryReport,
  ProjectReport,
  ProjectUser,
  SiteReport,
  SrpReport,
  User
} from "@terramatch-microservices/database/entities";
import { Dictionary, groupBy, isEmpty } from "lodash";
import { Op } from "sequelize";
import { TMLogger } from "../util/tm-logger";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { ModelCtor } from "sequelize-typescript";

type TaskReportType = "projectReports" | "siteReports" | "nurseryReports" | "srpReports";

const TASK_REPORT_TYPES: ReadonlySet<string> = new Set<TaskReportType>([
  "projectReports",
  "siteReports",
  "nurseryReports",
  "srpReports"
]);

const ENTITY_TYPE_NAMES: Record<TaskReportType, string> = {
  projectReports: "Project Report",
  siteReports: "Site Report",
  nurseryReports: "Nursery Report",
  srpReports: "SRP Report"
};

export class AdminReportReminderEmail extends EmailSender<AdminReminderEmailData> {
  static readonly NAME = "adminReportReminder";

  private readonly logger = new TMLogger(AdminReportReminderEmail.name);

  constructor(data: AdminReminderEmailData) {
    super(AdminReportReminderEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const reportType = this.data.type as TaskReportType;
    if (!TASK_REPORT_TYPES.has(reportType)) {
      this.logger.error(`Unsupported entity type for admin report reminder: ${this.data.type}`);
      return;
    }

    const result = await this.loadEntityData(reportType);
    if (result == null) {
      this.logger.error(`Could not load entity data for admin reminder [type=${this.data.type}, id=${this.data.id}]`);
      return;
    }

    const { entityModelName, entityStatus, callbackUrl, projectId } = result;
    const entityTypeName = ENTITY_TYPE_NAMES[reportType];
    const fullCallbackUrl = `${emailService.frontEndUrl}${callbackUrl}`;

    const users = await User.findAll({
      where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
      attributes: ["emailAddress", "locale"]
    });

    const recipients = emailService.filterEntityEmailRecipients(users);
    if (isEmpty(recipients)) {
      this.logger.debug(`No recipients found for admin report reminder [type=${this.data.type}, id=${this.data.id}]`);
      return;
    }

    const feedback = this.data.feedback ?? "";
    const i18nKeys: Dictionary<string> = {
      subject: "report-reminder.subject",
      title: "report-reminder.title",
      body: "report-reminder.body"
    };
    const i18nReplacements: Dictionary<string> = {
      "{entityTypeName}": entityTypeName,
      "{entityModelName}": entityModelName,
      "{entityStatus}": entityStatus,
      "{callbackUrl}": fullCallbackUrl,
      "{feedback}": feedback
    };

    await Promise.all(
      Object.entries(groupBy(recipients, "locale")).map(([locale, localeUsers]) =>
        emailService.sendI18nTemplateEmail(
          localeUsers.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          i18nKeys,
          { i18nReplacements }
        )
      )
    );
  }

  private async loadEntityData(reportType: TaskReportType) {
    const entityClass = ENTITY_MODELS[reportType] as ModelCtor<ProjectReport | SiteReport | NurseryReport | SrpReport>;

    const parentAssociation =
      reportType === "siteReports" ? "site" : reportType === "nurseryReports" ? "nursery" : "project";

    const entity = await entityClass.findOne({
      where: { id: this.data.id },
      attributes: ["id", "uuid", "status"],
      include: [
        { association: parentAssociation, attributes: ["name"] },
        {
          association: "task",
          attributes: ["uuid", "projectId"],
          include: [{ association: "project", attributes: ["uuid"] }]
        }
      ]
    });

    if (entity == null) return null;

    const task =
      entity instanceof ProjectReport ||
      entity instanceof SiteReport ||
      entity instanceof NurseryReport ||
      entity instanceof SrpReport
        ? entity.task
        : null;

    if (task == null) {
      this.logger.error(`Task not found for entity [type=${this.data.type}, id=${this.data.id}]`);
      return null;
    }

    if (task.project == null) {
      this.logger.error(`Task project not found for entity [type=${this.data.type}, id=${this.data.id}]`);
      return null;
    }

    let entityModelName: string;
    let projectId: number;
    if (entity instanceof ProjectReport) {
      entityModelName = entity.projectName ?? "";
      projectId = task.projectId ?? 0;
    } else if (entity instanceof SiteReport) {
      entityModelName = entity.siteName ?? "";
      projectId = task.projectId ?? 0;
    } else if (entity instanceof NurseryReport) {
      entityModelName = entity.nurseryName ?? "";
      projectId = task.projectId ?? 0;
    } else {
      entityModelName = (entity as SrpReport).projectName ?? "";
      projectId = (entity as SrpReport).projectId;
    }

    return {
      entityModelName,
      entityStatus: entity.status ?? "",
      callbackUrl: `/project/${task.project.uuid}/reporting-task/${task.uuid}`,
      projectId
    };
  }
}
