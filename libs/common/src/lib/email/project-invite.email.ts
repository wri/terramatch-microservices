import { Dictionary } from "lodash";
import { TMLogger } from "../util/tm-logger";
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Organisation, Project } from "@terramatch-microservices/database/entities";

type ProjectInviteEmailData = {
  projectId: number;
  emailAddress: string;
  token: string;
};

const EMAIL_PROJECT_INVITE_KEYS = {
  body: "v2-project-invite-received-create.body",
  subjectKey: "v2-project-invite-received-create.subject",
  titleKey: "v2-project-invite-received-create.title",
  ctaKey: "v2-project-invite-received-create.cta"
} as const;

export class ProjectInviteEmail extends EmailSender<ProjectInviteEmailData> {
  static readonly NAME = "projectInvite";

  private readonly logger = new TMLogger(ProjectInviteEmail.name);

  constructor(data: ProjectInviteEmailData) {
    super(ProjectInviteEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const project = await Project.findOne({
      where: { id: this.data.projectId },
      attributes: ["id", "name", "organisationId"]
    });
    if (project == null) {
      this.logger.error(`Project not found [${this.data.projectId}]`);
      return;
    }

    const organisation = await Organisation.findOne({
      where: { id: project.organisationId as number },
      attributes: ["name"]
    });

    if (organisation == null) {
      this.logger.error(`Organisation not found [${project.organisationId}]`);
      return;
    }

    const i18nReplacements: Dictionary<string> = {
      "{organisationName}": organisation.name as string,
      "{projectName}": project.name as string,
      "{to}": this.data.emailAddress
    };
    const additionalValues = {
      link: `/auth/reset-password/${this.data.token}`,
      transactional: "transactional"
    };
    await emailService.sendI18nTemplateEmail(this.data.emailAddress, "en-US", EMAIL_PROJECT_INVITE_KEYS, {
      i18nReplacements,
      additionalValues
    });
  }
}
