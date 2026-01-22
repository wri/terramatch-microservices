/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

export type ApplicationSubmittedEmailData = {
  message: string;
  userId: number;
};

export class ApplicationSubmittedEmail extends EmailSender<ApplicationSubmittedEmailData> {
  static readonly NAME = "applicationSubmitted";

  private readonly logger = new TMLogger(ApplicationSubmittedEmail.name);

  constructor(data: ApplicationSubmittedEmailData) {
    super(ApplicationSubmittedEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({ where: { id: this.data.userId }, attributes: ["emailAddress", "locale"] });
    if (user == null) {
      this.logger.error(`User not found [${this.data.userId}]`);
      return;
    }

    const { emailAddress, locale } = user;

    const i18nKeys = {
      subject: "application-submitted-confirmation.subject",
      title: "application-submitted-confirmation.title"
    };

    await emailService.sendI18nTemplateEmail(emailAddress, locale, i18nKeys, { body: this.data.message });
  }
}
