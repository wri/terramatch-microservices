import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { EmailService } from "./email.service";
import { Job } from "bullmq";
import {
  ENTITY_MODELS,
  EntityModel,
  EntityType,
  getProjectId
} from "@terramatch-microservices/database/constants/entities";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { TMLogger } from "../util/tm-logger";
import { APPROVED, NEEDS_MORE_INFORMATION } from "@terramatch-microservices/database/constants/status";
import { ProjectUser, User } from "@terramatch-microservices/database/entities";
import { isEmpty, map } from "lodash";
import { Op } from "sequelize";

export type StatusUpdateData = {
  type: EntityType;
  id: number;
};

/**
 * Watches for jobs related to sending email
 */
@Processor("email")
export class EmailProcessor extends WorkerHost {
  private readonly logger = new TMLogger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job) {
    const { name, data } = job;
    switch (name) {
      case "statusUpdate":
        return await this.sendStatusUpdateEmail(data as StatusUpdateData);

      default:
        throw new NotImplementedException(`Unknown job type: ${name}`);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
  }

  private async sendStatusUpdateEmail({ type, id }: StatusUpdateData) {
    const entityClass = ENTITY_MODELS[type];
    if (entityClass == null) {
      throw new InternalServerErrorException(`Entity model class not found for entity type [${type}]`);
    }

    const attributes = ["status", "updateRequestStatus"];
    const attributeKeys = Object.keys(entityClass.getAttributes());
    for (const parentId of ["projectId", "siteId", "nurseryId"]) {
      if (attributeKeys.includes(parentId)) attributes.push(parentId);
    }
    const entity = await entityClass.findOne({ where: { id }, attributes });
    if (entity == null) {
      throw new InternalServerErrorException(`Entity instance not found for id [type=${type}, id=${id}]`);
    }

    const status =
      entity.status === NEEDS_MORE_INFORMATION || entity.updateRequestStatus === NEEDS_MORE_INFORMATION
        ? NEEDS_MORE_INFORMATION
        : entity.status;
    if (![APPROVED, NEEDS_MORE_INFORMATION].includes(status)) return;

    const logExtras =
      `[type=${type}, id=${id}, status=${entity.status}, updateRequestStatus=${entity.updateRequestStatus}` as const;
    this.logger.log(`Sending status update email ${logExtras}`);

    const to = await this.getEntityUserEmails(entity);
    if (isEmpty(to)) {
      this.logger.debug(`No addresses found to send entity update to ${logExtras}`);
      return;
    }
  }

  private async getEntityUserEmails(entity: EntityModel) {
    const projectId = await getProjectId(entity);
    if (projectId == null) {
      this.logger.error(`Could not find project ID for entity [type=${entity.constructor.name}, id=${entity.id}]`);
      return;
    }

    const emailAddresses = map(
      await User.findAll({
        where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
        attributes: ["emailAddress"]
      }),
      "emailAddress"
    );
    return this.emailService.filterEntityEmailRecipients(emailAddresses);
  }
}
