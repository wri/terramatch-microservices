import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Organisation, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

export type OrganisationApprovedEmailData = {
  organisationId: number;
  approvedByUserId: number;
};

export class OrganisationApprovedEmail extends EmailSender<OrganisationApprovedEmailData> {
  static readonly NAME = "organisationApproved";

  private readonly logger = new TMLogger(OrganisationApprovedEmail.name);

  constructor(data: OrganisationApprovedEmailData) {
    super(OrganisationApprovedEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const organisation = await Organisation.findByPk(this.data.organisationId, {
      attributes: ["id", "uuid", "name"]
    });

    if (organisation == null) {
      this.logger.error(`Organisation not found [${this.data.organisationId}]`);
      return;
    }

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
      link: "/auth/login",
      transactional: "transactional"
    };

    await emailService.sendI18nTemplateEmail(
      primaryOwner.emailAddress,
      primaryOwner.locale,
      {
        subject: "organisation-approved.subject",
        title: "organisation-approved.title",
        body: "organisation-approved.body",
        cta: "organisation-approved.cta"
      },
      { additionalValues }
    );

    this.logger.log(`Sent organisation approved email to primary owner for organisation ${organisation.id}`);
  }
}
