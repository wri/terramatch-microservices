import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { Op } from "sequelize";
import {
  Form,
  FormSubmission,
  Notification,
  Organisation,
  Task,
  User
} from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import {
  FRAMEWORK_KEYS_TF_REPORT_REMINDER,
  FrameworkKeyTFReportReminder
} from "@terramatch-microservices/database/constants";
import { TerrafundReportReminderEmail } from "../email/terrafund-report-reminder.email";
import { ApplicationSubmittedEmail } from "../email/application-submitted.email";
import { OrganisationApprovedEmail } from "../email/organisation-approved.email";
import { UserContext } from "../contexts/user.context";
import { TMLogger } from "../util/tm-logger";

export const APPLICATION_SUBMITTED = "application-submitted";
export const ORGANISATION_APPROVED = "organisation-approved";

type NotificationPayloads = {
  [APPLICATION_SUBMITTED]: FormSubmission;
  [ORGANISATION_APPROVED]: Organisation;
};

export type NotificationKind = keyof NotificationPayloads;

type Notifiers = { [K in NotificationKind]: (payload: NotificationPayloads[K]) => Promise<void> };

@Injectable()
export class ProductEventService {
  private readonly logger = new TMLogger(ProductEventService.name);

  constructor(
    @InjectQueue("email") private readonly emailQueue: Queue,
    private readonly configService: ConfigService
  ) {}

  private readonly notifiers: Notifiers = {
    [APPLICATION_SUBMITTED]: submission => this.applicationSubmitted(submission),
    [ORGANISATION_APPROVED]: organisation => this.organisationApproved(organisation)
  };

  async notify<K extends NotificationKind>(kind: K, payload: NotificationPayloads[K]) {
    await this.notifiers[kind](payload);
  }

  async taskCreated(task: Task) {
    // TODO: This method is going to get a lot more sophisticated over time. For now, it's simply
    //   handling the email send that was going out in ScheduledJobsProcessor on reporting task
    //   creation

    if (task.category === "project-reporting") {
      const project = await task.$get("project", { attributes: ["id", "frameworkKey"] });
      const frameworkKey = project?.frameworkKey;
      if (
        frameworkKey != null &&
        FRAMEWORK_KEYS_TF_REPORT_REMINDER.includes(frameworkKey as FrameworkKeyTFReportReminder)
      ) {
        await new TerrafundReportReminderEmail({
          projectIds: [project?.id as number],
          dueAt: task.dueAt?.toISOString()
        }).sendLater(this.emailQueue);
      }
    }
  }

  private get isProd() {
    return this.configService.get<string>("DEPLOY_ENV") === "prod";
  }

  private async applicationSubmitted(submission: FormSubmission) {
    await this.sendApplicationSubmittedEmail(submission);

    // In-app notifications are limited to lower environments until the FE event center is released.
    if (!this.isProd) {
      await this.createOrganisationNotifications(submission.organisationUuid, {
        category: "applications",
        // TODO: the summary for this notification is TBD; this is placeholder copy until product finalizes it.
        summary: "Your organization has submitted an application.",
        referencedModel: FormSubmission.LARAVEL_TYPE,
        referencedModelId: submission.id
      });
    }
  }

  private async sendApplicationSubmittedEmail(submission: FormSubmission) {
    this.logger.log(`Sending application submitted email queue [${JSON.stringify({ id: submission.id })}]`);

    const userId = UserContext.authenticatedUserId;
    if (userId == null) {
      this.logger.error("Cannot send application submitted email without authenticated user");
      return;
    }

    const form =
      submission.form ??
      (submission.formId == null ? undefined : await Form.findOne({ where: { uuid: submission.formId } }));
    await new ApplicationSubmittedEmail({
      message: form?.submissionMessage ?? "Thank you for sending your application.",
      userId
    }).sendLater(this.emailQueue);
  }

  private async organisationApproved(organisation: Organisation) {
    const approvedByUserId = UserContext.authenticatedUserId;
    if (approvedByUserId == null) {
      this.logger.error("Cannot send organisation approved email without authenticated user");
      return;
    }

    await new OrganisationApprovedEmail({ organisationId: organisation.id, approvedByUserId }).sendLater(
      this.emailQueue
    );
    this.logger.log(`Queued organisation approved email for organisation ${organisation.id}`);
  }

  private async createOrganisationNotifications(
    organisationUuid: string | null,
    attributes: Pick<Notification, "category" | "summary" | "referencedModel" | "referencedModelId">
  ) {
    if (organisationUuid == null) return;

    const organisationId = Subquery.select(Organisation, "id").eq("uuid", organisationUuid).literal;
    const users = await User.findAll({
      where: { organisationId: { [Op.in]: organisationId } },
      attributes: ["id"]
    });
    if (users.length === 0) return;

    const createdBy = UserContext.authenticatedUserId ?? null;
    await Notification.bulkCreate(users.map(({ id }) => ({ ...attributes, userId: id, createdBy })));
  }
}
