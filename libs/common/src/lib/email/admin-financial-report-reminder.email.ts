/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { AdminReminderEmailData } from "./email.processor";
import { FinancialReport, OrganisationUser, User } from "@terramatch-microservices/database/entities";
import { Dictionary, groupBy, isEmpty, uniqBy } from "lodash";
import { Op } from "sequelize";
import { TMLogger } from "../util/tm-logger";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

export class AdminFinancialReportReminderEmail extends EmailSender<AdminReminderEmailData> {
  static readonly NAME = "adminFinancialReportReminder";

  private readonly logger = new TMLogger(AdminFinancialReportReminderEmail.name);

  constructor(data: AdminReminderEmailData) {
    super(AdminFinancialReportReminderEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    if (this.data.type !== "financialReports") {
      this.logger.error(`AdminFinancialReportReminderEmail received unexpected type: ${this.data.type}`);
      return;
    }

    const report = await FinancialReport.findOne({
      where: { id: this.data.id },
      attributes: ["id", "uuid", "status", "organisationId", "dueAt"],
      include: [{ association: "organisation", attributes: ["uuid", "name"] }]
    });

    if (report == null) {
      this.logger.error(`Financial report not found [id=${this.data.id}]`);
      return;
    }

    if (report.organisation == null) {
      this.logger.error(`Organisation not found for financial report [id=${this.data.id}]`);
      return;
    }

    const organisationId = report.organisationId;
    const users = await this.getOrganisationUsers(organisationId);
    const recipients = emailService.filterEntityEmailRecipients(users);

    if (isEmpty(recipients)) {
      this.logger.debug(`No recipients found for financial report reminder [id=${this.data.id}]`);
      return;
    }

    const baseUrl = emailService.getFrontEndUrl();
    const orgUuid = report.organisation.uuid;
    const callbackUrl = `${baseUrl}/organization/${orgUuid}?tab=financial_information`;
    const myOrgLink = `${baseUrl}/organisation/${orgUuid}`;
    const dueAt = report.dueAt != null ? this.formatDate(report.dueAt) : "";

    const i18nKeys: Dictionary<string> = {
      subject: "financial-report-reminder.subject",
      title: "financial-report-reminder.title",
      body: "financial-report-reminder.body",
      cta: "financial-report-reminder.cta"
    };
    const i18nReplacements: Dictionary<string> = {
      "{entityModelName}": report.organisationName ?? "",
      "{dueAt}": dueAt,
      "{callbackUrl}": myOrgLink,
      "{reportUrl}": callbackUrl
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

  private async getOrganisationUsers(organisationId: number): Promise<User[]> {
    const partnerUserIds = (
      await OrganisationUser.findAll({
        where: { organisationId },
        attributes: ["userId"]
      })
    ).map(({ userId }) => userId);

    const [owners, partners] = await Promise.all([
      User.findAll({
        where: { organisationId },
        attributes: ["id", "emailAddress", "locale"]
      }),
      partnerUserIds.length > 0
        ? User.findAll({
            where: { id: { [Op.in]: partnerUserIds } },
            attributes: ["id", "emailAddress", "locale"]
          })
        : Promise.resolve([])
    ]);

    return uniqBy([...owners, ...partners], "id");
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = date.toLocaleString("en-GB", { month: "short" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}
