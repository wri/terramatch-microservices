import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { EmailService } from "./email.service";
import { Job } from "bullmq";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import { NotImplementedException } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { TMLogger } from "../util/tm-logger";
import { EntityStatusUpdateEmail } from "./entity-status-update.email";
import { TerrafundReportReminderEmail } from "./terrafund-report-reminder.email";
import { TerrafundSiteAndNurseryReminderEmail } from "./terrafund-site-and-nursery-reminder.email";
import { AdminUserCreationEmail } from "./admin-user-creation.email";
import { PolygonClippingCompleteEmail } from "./polygon-clipping-complete.email";

export type StatusUpdateData = {
  type: EntityType;
  id: number;
};

export type ProjectEmailData = {
  projectIds: number[];
};

const EMAIL_PROCESSORS = {
  statusUpdate: EntityStatusUpdateEmail,
  terrafundReportReminder: TerrafundReportReminderEmail,
  terrafundSiteAndNurseryReminder: TerrafundSiteAndNurseryReminderEmail,
  adminUserCreation: AdminUserCreationEmail,
  polygonClippingComplete: PolygonClippingCompleteEmail
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
    const processor = EMAIL_PROCESSORS[name as keyof typeof EMAIL_PROCESSORS];
    if (processor == null) {
      throw new NotImplementedException(`Unknown job type: ${name}`);
    }

    await new processor(data).send(this.emailService);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
  }
}
