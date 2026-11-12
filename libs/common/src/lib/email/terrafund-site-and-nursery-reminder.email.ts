/* istanbul ignore file */
import { EmailService } from "./email.service";
import { ProjectEmailSender } from "./project-email-sender";
import { TMLogger } from "../util/tm-logger";
import { Project, User } from "@terramatch-microservices/database/entities";
import { groupBy } from "lodash";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { ProjectEmailData } from "./email.processor";
import { TERRAFUND_NON_PROFITS } from "@terramatch-microservices/database/constants";

export class TerrafundSiteAndNurseryReminderEmail extends ProjectEmailSender {
  static readonly NAME = "terrafundSiteAndNurseryReminder";

  override logger = new TMLogger(TerrafundSiteAndNurseryReminderEmail.name);

  constructor(data: ProjectEmailData) {
    super(TerrafundSiteAndNurseryReminderEmail.NAME, data);
  }

  async sendForProject(projectId: number, users: User[], emailService: EmailService) {
    const project = await Project.findOne({ where: { id: projectId }, attributes: ["frameworkKey"] });
    if (project?.frameworkKey !== TERRAFUND_NON_PROFITS) {
      this.logger.error(
        `Asked to send terrafund site and nursery reminder email for unsupported project [${projectId}, ${project?.frameworkKey}]`
      );
      return;
    }

    await Promise.all(
      Object.entries(groupBy(users, "locale")).map(([locale, localeGroup]) =>
        emailService.sendI18nTemplateEmail(
          localeGroup.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          {
            title: "terrafund-site-and-nursery-reminder.title",
            subject: "terrafund-site-and-nursery-reminder.subject",
            body: "terrafund-site-and-nursery-reminder.body",
            cta: "terrafund-site-and-nursery-reminder.cta"
          },
          {
            additionalValues: {
              link: `/terrafund/programmeOverview/${projectId}`
            }
          }
        )
      )
    );
  }
}
