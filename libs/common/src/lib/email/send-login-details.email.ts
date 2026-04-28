import { Dictionary } from "lodash";
import { TMLogger } from "../util/tm-logger";
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";

export type SendLoginDetailsEmailData = {
  emailAddress: string;
  userName: string;
  token: string;
};

export class SendLoginDetailsEmail extends EmailSender<SendLoginDetailsEmailData> {
  static readonly NAME = "sendLoginDetails";

  private readonly logger = new TMLogger(SendLoginDetailsEmail.name);

  constructor(data: SendLoginDetailsEmailData) {
    super(SendLoginDetailsEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const baseUrl = emailService.getFrontEndUrl();
    const encodedToken = encodeURIComponent(this.data.token);
    const link = `${baseUrl}/auth/set-password/${encodedToken}`;
    const i18nReplacements: Dictionary<string> = {
      "{userName}": this.data.userName,
      "{mail}": this.data.emailAddress
    };
    const additionalValues = {
      link
    };
    await emailService.sendI18nTemplateEmail(
      this.data.emailAddress,
      "en-US",
      {
        subject: "send-login-details.subject",
        title: "send-login-details.title",
        body: "send-login-details.body",
        cta: "send-login-details.cta"
      },
      { i18nReplacements, additionalValues }
    );

    this.logger.log(`Sent login details email to ${this.data.emailAddress}`);
  }
}
