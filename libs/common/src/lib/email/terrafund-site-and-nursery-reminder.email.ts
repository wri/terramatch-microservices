import { EmailService } from "./email.service";
import { ProjectEmailSender } from "./project-email-sender";
import { TMLogger } from "../util/tm-logger";
import { Project, User } from "@terramatch-microservices/database/entities";
import { groupBy } from "lodash";

export class TerrafundSiteAndNurseryReminderEmail extends ProjectEmailSender {
  override logger = new TMLogger(TerrafundSiteAndNurseryReminderEmail.name);

  async sendForProject(projectId: number, users: User[], emailService: EmailService) {
    const project = await Project.findOne({ where: { id: projectId }, attributes: ["frameworkKey"] });
    if (project?.frameworkKey !== "terrafund") {
      this.logger.error(
        `Asked to send terrafund site and nursery reminder email for non-terrafund project [${projectId}, ${project?.frameworkKey}]`
      );
      return;
    }

    await Promise.all(
      Object.entries(groupBy(users, "locale")).map(([locale, localeGroup]) =>
        emailService.sendI18nTemplateEmail(
          localeGroup.map(({ emailAddress }) => emailAddress),
          locale,
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
