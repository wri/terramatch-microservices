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
import { ProjectManagerEmail } from "./project-manager.email";
import { ApplicationSubmittedEmail } from "./application-submitted.email";
import { EmailSender } from "./email-sender";
import { FormSubmissionFeedbackEmail } from "./form-submission-feedback.email";
import { PolygonClippingCompleteEmail } from "./polygon-clipping-complete.email";
import { OrganisationApprovedEmail } from "./organisation-approved.email";
import { OrganisationRejectedEmail } from "./organisation-rejected.email";
import { OrganisationJoinRequestEmail } from "./organisation-join-request.email";

export type SpecificEntityData = {
  type: EntityType;
  id: number;
};

export type ProjectEmailData = {
  projectIds: number[];
};

const EMAIL_PROCESSORS: ((new (data: unknown) => EmailSender<unknown>) & { NAME: string })[] = [
  EntityStatusUpdateEmail,
  TerrafundReportReminderEmail,
  TerrafundSiteAndNurseryReminderEmail,
  AdminUserCreationEmail,
  ProjectManagerEmail,
  ApplicationSubmittedEmail,
  FormSubmissionFeedbackEmail,
  PolygonClippingCompleteEmail,
  OrganisationApprovedEmail,
  OrganisationRejectedEmail,
  OrganisationJoinRequestEmail
];

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
    const processor = EMAIL_PROCESSORS.find(processor => processor.NAME === name);
    if (processor == null) {
      throw new NotImplementedException(`Unknown email name [${name}]`);
    }

    await new processor(data).send(this.emailService);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    Sentry.captureException(error);
    this.logger.error(`Worker event failed: ${JSON.stringify(job)}`, error.stack);
  }
}
