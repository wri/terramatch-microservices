/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { TMLogger } from "../util/tm-logger";
import { EmailService } from "./email.service";
import { ProjectEmailData } from "./email.processor";
import { ProjectUser, User } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

export abstract class ProjectEmailSender extends EmailSender {
  protected readonly logger = new TMLogger(ProjectEmailSender.name);

  protected readonly projectIds: number[];

  constructor({ projectIds }: ProjectEmailData) {
    super();
    this.projectIds = projectIds;
  }

  async send(emailService: EmailService) {
    const results = await Promise.allSettled(
      this.projectIds.map(async projectId => {
        const users = await User.findAll({
          where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
          attributes: ["id", "emailAddress", "locale"]
        });
        return this.sendForProject(projectId, users, emailService);
      })
    );

    const failed = results.filter(({ status }) => status === "rejected");
    if (failed.length > 0) {
      this.logger.error(`Failed to send project emails: ${JSON.stringify(failed)}`);
    }
  }

  abstract sendForProject(projectId: number, users: User[], emailService: EmailService): Promise<void>;
}
