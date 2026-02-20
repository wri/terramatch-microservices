import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Organisation, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

export type OrganisationJoinRequestEmailData = {
  organisationId: number;
  requestingUserId: number;
};

export class OrganisationJoinRequestEmail extends EmailSender<OrganisationJoinRequestEmailData> {
  static readonly NAME = "organisationJoinRequest";

  private readonly logger = new TMLogger(OrganisationJoinRequestEmail.name);

  constructor(data: OrganisationJoinRequestEmailData) {
    super(OrganisationJoinRequestEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const organisation = await Organisation.findByPk(this.data.organisationId, {
      attributes: ["id", "uuid", "name"]
    });

    if (organisation == null) {
      this.logger.error(`Organisation not found [${this.data.organisationId}]`);
      return;
    }

    const owners = await User.findAll({
      where: { organisationId: organisation.id },
      attributes: ["id", "emailAddress", "locale"]
    });

    if (owners.length === 0) {
      this.logger.warn(`No owners found for organisation [${organisation.id}]`);
      return;
    }

    const requestingUser = await User.findByPk(this.data.requestingUserId, {
      attributes: ["firstName", "lastName", "emailAddress"]
    });

    let requestingUserName = "A user";
    if (requestingUser != null) {
      const fullName = `${requestingUser.firstName ?? ""} ${requestingUser.lastName ?? ""}`.trim();
      requestingUserName = fullName !== "" ? fullName : requestingUser.emailAddress ?? "A user";
    }

    await Promise.all(
      owners
        .filter(owner => owner.emailAddress != null)
        .map(owner => {
          if (owner.emailAddress == null) {
            return Promise.resolve();
          }

          return emailService.sendI18nTemplateEmail(
            owner.emailAddress,
            owner.locale,
            {
              subject: "organisation-join-request.subject",
              title: "organisation-join-request.title",
              body: "organisation-join-request.body",
              cta: "organisation-join-request.cta"
            },
            {
              additionalValues: {
                link: "/auth/login",
                transactional: "transactional"
              },
              i18nReplacements: {
                "{requestingUserName}": requestingUserName,
                "{organisationName}": organisation.name ?? "the organisation"
              }
            }
          );
        })
    );
  }
}
