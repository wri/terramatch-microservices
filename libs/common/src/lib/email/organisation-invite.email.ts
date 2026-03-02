import { Dictionary } from "lodash";
import { TMLogger } from "../util/tm-logger";
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Organisation } from "@terramatch-microservices/database/entities";

const DEFAULT_SIGNUP_BASE = "/auth/signup";

type OrganisationInviteEmailData = {
  organisationId: number;
  emailAddress: string;
  token: string;
  callbackUrl?: string | null;
};

const EMAIL_ORGANISATION_INVITE_KEYS = {
  body: "v2-organisation-invite-received-create.body",
  subjectKey: "v2-organisation-invite-received-create.subject",
  titleKey: "v2-organisation-invite-received-create.title",
  ctaKey: "v2-organisation-invite-received-create.cta"
} as const;

export class OrganisationInviteEmail extends EmailSender<OrganisationInviteEmailData> {
  static readonly NAME = "organisationInvite";

  private readonly logger = new TMLogger(OrganisationInviteEmail.name);

  constructor(data: OrganisationInviteEmailData) {
    super(OrganisationInviteEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const organisation = await Organisation.findOne({
      where: { id: this.data.organisationId },
      attributes: ["id", "name"]
    });
    if (organisation == null) {
      this.logger.error(`Organisation not found [${this.data.organisationId}]`);
      return;
    }

    const base = this.data.callbackUrl ?? DEFAULT_SIGNUP_BASE;
    const link = `${base.replace(/\/$/, "")}/${this.data.token}`;

    const i18nReplacements: Dictionary<string> = {
      "{organisationName}": organisation.name ?? ""
    };
    const additionalValues = {
      link,
      transactional: "transactional"
    };
    await emailService.sendI18nTemplateEmail(this.data.emailAddress, "en-US", EMAIL_ORGANISATION_INVITE_KEYS, {
      i18nReplacements,
      additionalValues
    });
  }
}
