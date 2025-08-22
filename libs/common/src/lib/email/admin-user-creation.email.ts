import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Dictionary } from "lodash";
import { User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Queue } from "bullmq";

type AdminUserCreationEmailData = {
  userId: number;
  fundingProgrammeName: string;
};

export class AdminUserCreationEmail extends EmailSender {
  private readonly logger = new TMLogger(AdminUserCreationEmail.name);

  private readonly userId: number;
  private readonly fundingProgrammeName: string;

  constructor({ userId, fundingProgrammeName }: AdminUserCreationEmailData) {
    super();
    this.userId = userId;
    this.fundingProgrammeName = fundingProgrammeName;
  }

  async sendLater(queue: Queue) {
    await queue.add("adminUserCreation", { userId: this.userId, fundingProgrammeName: this.fundingProgrammeName });
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["emailAddress", "firstName", "lastName", "locale"]
    });
    if (user == null) {
      this.logger.error(`User not found [${this.userId}]`);
      return;
    }
    if (user.emailAddress == null) {
      this.logger.error(`User has no email address [${this.userId}]`);
      return;
    }

    const i18nReplacements: Dictionary<string> = {
      userName: user.fullName ?? "",
      mail: user.emailAddress,
      fundingProgrammeName: this.fundingProgrammeName
    };
    const additionalValues = {
      link: "auth/reset-password",
      transactional: "transactional"
    };
    await emailService.sendI18nTemplateEmail(
      user.emailAddress,
      user.locale,
      {
        subject: "bulk-user-creation.subject",
        title: "bulk-user-creation.title",
        body: "bulk-user-creation.body",
        cta: "bulk-user-creation.cta"
      },
      { i18nReplacements, additionalValues }
    );
  }
}
