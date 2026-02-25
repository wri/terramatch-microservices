import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Organisation, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

export type OrganisationUserRejectedEmailData = {
  organisationId: number;
  userId: number;
};

export class OrganisationUserRejectedEmail extends EmailSender<OrganisationUserRejectedEmailData> {
  static readonly NAME = "organisationUserRejected";

  private readonly logger = new TMLogger(OrganisationUserRejectedEmail.name);

  constructor(data: OrganisationUserRejectedEmailData) {
    super(OrganisationUserRejectedEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const organisation = await Organisation.findByPk(this.data.organisationId, {
      attributes: ["id", "uuid", "name"]
    });

    if (organisation == null) {
      this.logger.error(`Organisation not found [${this.data.organisationId}]`);
      return;
    }

    const user = await User.findByPk(this.data.userId, {
      attributes: ["id", "emailAddress", "locale"]
    });

    if (user == null) {
      this.logger.error(`User not found [${this.data.userId}]`);
      return;
    }

    if (user.emailAddress == null) {
      this.logger.error(`User has no email address [userId=${this.data.userId}]`);
      return;
    }

    if (organisation.name == null) {
      this.logger.error(`Organisation has no name [organisationId=${this.data.organisationId}]`);
      return;
    }

    await emailService.sendI18nTemplateEmail(
      user.emailAddress,
      user.locale,
      {
        subject: "organisation-user-rejected.subject",
        title: "organisation-user-rejected.title",
        body: "organisation-user-rejected.body"
      },
      {
        i18nReplacements: {
          "{organisationName}": organisation.name
        },
        additionalValues: {
          transactional: "transactional"
        }
      }
    );

    this.logger.log(
      `Sent organisation user rejected email to user ${this.data.userId} for organisation ${this.data.organisationId}`
    );
  }
}
