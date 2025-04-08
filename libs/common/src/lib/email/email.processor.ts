import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { EmailService } from "./email.service";
import { Job } from "bullmq";
import { ENTITY_MODELS, EntityType } from "@terramatch-microservices/database/constants/entities";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { TMLogger } from "../util/tm-logger";
import { APPROVED, NEEDS_MORE_INFORMATION } from "@terramatch-microservices/database/constants/status";

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

    const entity = await entityClass.findOne({ where: { id } });
    if (entity == null) {
      throw new InternalServerErrorException(`Entity instance not found for id [type=${type}, id=${id}]`);
    }

    if (
      ![APPROVED, NEEDS_MORE_INFORMATION].includes(entity.status) &&
      entity.updateRequestStatus !== NEEDS_MORE_INFORMATION
    ) {
      return;
    }

    this.logger.log(
      `Sending status update email [type=${type}, id=${id}, status=${entity.status}, urStatus=${entity.updateRequestStatus}]`
    );
  }
}
