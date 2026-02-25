import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Organisation, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

export type OrganisationRejectedEmailData = {
  organisationId: number;
  rejectedByUserId: number;
};

export class OrganisationRejectedEmail extends EmailSender<OrganisationRejectedEmailData> {
  static readonly NAME = "organisationRejected";

  private readonly logger = new TMLogger(OrganisationRejectedEmail.name);

  constructor(data: OrganisationRejectedEmailData) {
    super(OrganisationRejectedEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const organisation = await Organisation.findByPk(this.data.organisationId, {
      attributes: ["id", "uuid", "name"]
    });

    if (organisation == null) {
      this.logger.error(`Organisation not found [${this.data.organisationId}]`);
      return;
    }

    // Find primary owner (user with organisationId = organisation.id)
    const primaryOwner = await User.findOne({
      where: { organisationId: organisation.id },
      attributes: ["emailAddress", "locale"]
    });

    if (primaryOwner == null) {
      this.logger.warn(`No primary owner found for organisation [${organisation.id}]`);
      return;
    }

    if (primaryOwner.emailAddress == null) {
      this.logger.error(`Primary owner has no email address [organisationId=${organisation.id}]`);
      return;
    }

    const additionalValues = {
      transactional: "transactional"
    };

    await emailService.sendI18nTemplateEmail(
      primaryOwner.emailAddress,
      primaryOwner.locale,
      {
        subject: "organisation-rejected.subject",
        title: "organisation-rejected.title",
        body: "organisation-rejected.body"
      },
      { additionalValues }
    );

    this.logger.log(`Sent organisation rejected email to primary owner for organisation ${organisation.id}`);
  }
}
