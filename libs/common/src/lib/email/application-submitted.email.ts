/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Queue } from "bullmq";

export type ApplicationSubmittedEmailData = {
  message: string;
  userId: number;
};

export class ApplicationSubmittedEmail extends EmailSender {
  private readonly logger = new TMLogger(ApplicationSubmittedEmail.name);

  private readonly message: string;
  private readonly userId: number;

  constructor({ message, userId }: ApplicationSubmittedEmailData) {
    super();
    this.message = message;
    this.userId = userId;
  }

  async sendLater(emailQueue: Queue) {
    await emailQueue.add("applicationSubmitted", { message: this.message, userId: this.userId });
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({ where: { id: this.userId }, attributes: ["emailAddress", "locale"] });
    if (user == null) {
      this.logger.error(`User not found [${this.userId}]`);
      return;
    }

    const { emailAddress, locale } = user;

    const i18nKeys = {
      subject: "application-submitted-confirmation.subject",
      title: "application-submitted-confirmation.title"
    };

    await emailService.sendI18nTemplateEmail(emailAddress, locale, i18nKeys, { body: this.message });
  }
}
