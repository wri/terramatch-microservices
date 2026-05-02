import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "./email.service";
import { Dictionary } from "lodash";

// This email is only sent from the REPL bulkUserImport script, so it's not configured as a
// queued EmailSender like most of our emails.
export class BulkUserCreationEmail {
  constructor(
    private readonly token: string,
    private readonly fundingProgrammeName: string,
    private readonly user: User
  ) {}

  async send(emailService: EmailService) {
    const i18nReplacements: Dictionary<string> = {
      "{userName}": this.user.fullName ?? "",
      "{mail}": this.user.emailAddress,
      "{fundingProgrammeName}": this.fundingProgrammeName
    };
    const additionalValues = {
      link: `${emailService.frontEndUrl}/auth/set-password/${encodeURIComponent(this.token)}`
    };
    await emailService.sendI18nTemplateEmail(
      this.user.emailAddress,
      this.user.locale,
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
