/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { TMLogger } from "../util/tm-logger";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import { Dictionary, escape } from "lodash";

export type FormSubmissionFeedbackEmailData = {
  submissionId: number;
  projectUuid?: string;
};

const escapeFeedback = (feedback: string | null) => escape(feedback ?? "").replaceAll("\n", "<br />\n");
const withPrefix = (
  prefix: string,
  feedback: string | null,
  i18nKeys: Dictionary<string>,
  i18nReplacements: Dictionary<string>
) => {
  i18nKeys.subject = `form-submission-${prefix}.subject`;
  i18nKeys.title = `form-submission-${prefix}.title`;
  i18nKeys.body = feedback == null ? `form-submission-${prefix}.body` : `form-submission-${prefix}.body-feedback`;
  i18nReplacements["{feedback}"] = escapeFeedback(feedback);
};

export class FormSubmissionFeedbackEmail extends EmailSender<FormSubmissionFeedbackEmailData> {
  static readonly NAME = "formSubmissionFeedback";

  private readonly logger = new TMLogger(FormSubmissionFeedbackEmail.name);

  constructor(data: FormSubmissionFeedbackEmailData) {
    super(FormSubmissionFeedbackEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const submission = await FormSubmission.findOne({
      where: { id: this.data.submissionId },
      attributes: ["status", "feedback"],
      include: [
        { association: "user", attributes: ["emailAddress", "locale"] },
        { association: "application", attributes: ["uuid"] },
        { association: "stage", attributes: ["order", "fundingProgrammeId"] }
      ]
    });
    if (submission == null) {
      this.logger.error(`Submission not found [${this.data.submissionId}]`);
      return;
    }
    if (submission.applicationUuid == null) {
      this.logger.error(`Submission does not have an application [${this.data.submissionId}]`);
      return;
    }
    if (submission.user == null) {
      this.logger.error(`Submission does not have a user [${this.data.submissionId}]`);
      return;
    }

    const {
      status,
      feedback,
      applicationUuid,
      user: { emailAddress, locale },
      stage
    } = submission;

    const i18nKeys: Dictionary<string> = {};
    const i18nReplacements: Dictionary<string> = {};
    const additionalValues: Dictionary<string> = {
      link: `/applications/${applicationUuid}`
    };
    switch (status) {
      case "information-required":
        withPrefix("feedback-received", feedback, i18nKeys, i18nReplacements);
        i18nKeys.cta = "form-submission-feedback-received.cta";
        break;

      case "rejected":
        withPrefix("rejected", feedback, i18nKeys, i18nReplacements);
        delete additionalValues.link;
        break;

      case "approved": {
        const isFinalStage = stage == null || (await stage.isFinalStage());
        const prefix = isFinalStage ? "final-stage-approved" : "approved";
        withPrefix(prefix, feedback, i18nKeys, i18nReplacements);
        i18nKeys.cta = `form-submission-${prefix}.cta`;
        if (this.data.projectUuid != null) {
          additionalValues.link = `/project/${this.data.projectUuid}`;
        }
        break;
      }

      default:
        return;
    }

    await emailService.sendI18nTemplateEmail(emailAddress, locale, i18nKeys, { additionalValues, i18nReplacements });
  }
}
