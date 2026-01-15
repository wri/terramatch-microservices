/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Dictionary } from "lodash";
import { User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

type AdminUserCreationEmailData = {
  userId: number;
  fundingProgrammeName: string;
};

export class AdminUserCreationEmail extends EmailSender<AdminUserCreationEmailData> {
  static readonly NAME = "adminUserCreation";

  private readonly logger = new TMLogger(AdminUserCreationEmail.name);

  constructor(data: AdminUserCreationEmailData) {
    super(AdminUserCreationEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({
      where: { id: this.data.userId },
      attributes: ["uuid", "emailAddress", "firstName", "lastName", "locale"]
    });
    if (user == null) {
      this.logger.error(`User not found [${this.data.userId}]`);
      return;
    }
    if (user.emailAddress == null) {
      this.logger.error(`User has no email address [${this.data.userId}]`);
      return;
    }

    const i18nReplacements: Dictionary<string> = {
      "{userName}": user.fullName ?? "",
      "{mail}": user.emailAddress,
      "{fundingProgrammeName}": this.data.fundingProgrammeName
    };
    const resetToken = await emailService.jwtService.signAsync({ sub: user.uuid }, { expiresIn: "7d" });
    const additionalValues = {
      link: `/auth/reset-password/${resetToken}`,
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
