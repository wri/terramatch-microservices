import { laravelType, StatusUpdateModel } from "@terramatch-microservices/database/types/util";
import { EventProcessor } from "./event.processor";
import { TMLogger } from "../util/tm-logger";
import {
  ENTITY_MODELS,
  EntityModel,
  EntityType,
  getOrganisationId,
  getProjectId,
  hasNothingToReport,
  hasTaskId,
  isEntity,
  isReport,
  ReportModel
} from "@terramatch-microservices/database/constants/entities";
import { EventService } from "./event.service";
import {
  Action,
  Application,
  AuditStatus,
  FinancialReport,
  Form,
  FormQuestion,
  FormSubmission,
  NurseryReport,
  ProjectReport,
  ProjectPitch,
  SiteReport,
  Task,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import { flatten, get, isEmpty, isEqual, map, uniq } from "lodash";
import { Op } from "sequelize";
import {
  AnyStatus,
  APPROVED,
  AWAITING_APPROVAL,
  DUE,
  NEEDS_MORE_INFORMATION,
  REJECTED,
  REQUIRES_MORE_INFORMATION,
  STARTED,
  STATUS_DISPLAY_STRINGS
} from "@terramatch-microservices/database/constants/status";
import { InternalServerErrorException } from "@nestjs/common";
import { LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { Model } from "sequelize-typescript";
import { getLinkedFieldConfig } from "../linkedFields";
import { isField, LinkedField } from "@terramatch-microservices/database/constants/linked-fields";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { APPROVAL_PROCESSERS } from "./processors";
import { authenticatedUserId } from "../guards/auth.guard";
import { LinkedAnswerCollector } from "../linkedFields/linkedAnswerCollector";
import { ApplicationSubmittedEmail } from "../email/application-submitted.email";
import { EntityStatusUpdateEmail } from "../email/entity-status-update.email";
import { ProjectManagerEmail } from "../email/project-manager.email";
import { FormSubmissionFeedbackEmail } from "../email/form-submission-feedback.email";

const TASK_UPDATE_REPORT_STATUSES = [APPROVED, NEEDS_MORE_INFORMATION, AWAITING_APPROVAL];

/** Report statuses that require user action (pending reports). */
const PENDING_REPORT_STATUSES = [DUE, STARTED, NEEDS_MORE_INFORMATION] as const;

const getEntityType = (model: Model) =>
  Object.entries(ENTITY_MODELS).find(([, entityClass]) => model instanceof entityClass)?.[0] as EntityType | undefined;

export class EntityStatusUpdate extends EventProcessor {
  private readonly logger = new TMLogger(EntityStatusUpdate.name);

  constructor(eventService: EventService, private readonly model: StatusUpdateModel) {
    super(eventService);
  }

  async handle() {
    this.logger.log(
      `Received model status update [${JSON.stringify({
        type: this.model.constructor.name,
        id: this.model.id,
        status: this.model.status
      })}]`
    );

    await this.eventService.sendStatusUpdateAnalytics(this.model.uuid, laravelType(this.model), this.model.status);

    if (this.model instanceof UpdateRequest) {
      await this.handleUpdateRequest(this.model);
    } else if (this.model instanceof FormSubmission) {
      await this.handleFormSubmission(this.model);
    } else {
      await this.handleBaseModel();
    }
  }

  private async handleBaseModel() {
    const entityType = getEntityType(this.model);
    if (entityType != null) {
      await this.sendStatusUpdateEmail(entityType);
      await this.updateActions();

      if (this.model.status === AWAITING_APPROVAL) {
        await this.sendProjectManagerEmail(entityType);
      } else if (this.model.status === APPROVED) {
        await Promise.all(
          APPROVAL_PROCESSERS.map(processor =>
            processor.processEntityApproval(this.model as EntityModel, this.eventService.mediaService)
          )
        );
      }
    }

    await this.createAuditStatus();

    if (
      entityType != null &&
      isReport(this.model as EntityModel) &&
      TASK_UPDATE_REPORT_STATUSES.includes(this.model.status)
    ) {
      await this.checkTaskStatus();
    }
  }

  private async handleUpdateRequest(updateRequest: UpdateRequest) {
    const baseModelClass = LARAVEL_MODELS[updateRequest.updateRequestableType];

    // FinancialReport requires the organisation relation to be loaded for Form.for() scope
    const include = updateRequest.updateRequestableType === FinancialReport.LARAVEL_TYPE ? ["organisation"] : undefined;

    const baseModel = await baseModelClass?.findOne({
      where: { id: updateRequest.updateRequestableId },
      include
    });

    if (baseModel == null) {
      this.logger.error("Cannot find base model for update request", {
        id: updateRequest.id,
        laravelType: updateRequest.updateRequestableType,
        baseModelId: updateRequest.updateRequestableId
      });
      return;
    }
    if (!isEntity(baseModel)) {
      this.logger.error("Got update request attached to invalid model type", {
        id: updateRequest.id,
        laravelType: updateRequest.updateRequestableType,
        baseModelId: updateRequest.updateRequestableId
      });
      return;
    }

    baseModel.updateRequestStatus = updateRequest.status;
    if (updateRequest.status === APPROVED) {
      baseModel.status = APPROVED;
      baseModel.feedback = updateRequest.feedback;
      baseModel.feedbackFields = null;
      if (hasNothingToReport(baseModel)) {
        baseModel.nothingToReport = false;
      }
    } else if (updateRequest.status === NEEDS_MORE_INFORMATION) {
      const entityType = getEntityType(baseModel);
      if (entityType != null) {
        await this.sendStatusUpdateEmail(entityType);
      }
    }

    await baseModel.save();

    if (updateRequest.status !== APPROVED && isReport(baseModel) && hasTaskId(baseModel)) {
      // if we didn't update the base model status, and it's a report, we need to run the task check
      // explicitly.
      await this.checkTaskStatus(baseModel);
    }

    await Action.for(baseModel).destroy({ where: { type: "notification" } });

    if (updateRequest.status === AWAITING_APPROVAL) {
      const entityType = getEntityType(baseModel);
      if (entityType != null) {
        // Gather linked field labels for the audit status.
        const questionUuids = Object.keys(updateRequest.content ?? {});
        const fieldQuestions = (
          await FormQuestion.findAll({
            where: { uuid: { [Op.in]: questionUuids }, linkedFieldKey: { [Op.ne]: null } }
          })
        ).filter(({ linkedFieldKey }) => {
          const config = linkedFieldKey == null ? undefined : getLinkedFieldConfig(linkedFieldKey);
          return config != null && isField(config.field);
        });

        const collector = new LinkedAnswerCollector(this.eventService.mediaService);
        const modelAnswers = await collector.getAnswers({}, fieldQuestions, { [entityType]: baseModel });
        const labels = fieldQuestions
          .map(question => {
            const updateRequestValue = updateRequest.content?.[question.uuid];
            const baseValue = modelAnswers[question.uuid];
            if (isEqual(updateRequestValue, baseValue)) return undefined;

            // We've already filtered the questions to only those with Field configs, so this cast is safe.
            return (getLinkedFieldConfig(question.linkedFieldKey ?? "")?.field as LinkedField).label;
          })
          .filter(isNotNull);
        await this.createAuditStatus(baseModel, AWAITING_APPROVAL, `Awaiting Review: ${labels.join(", ")}`);
        await this.sendProjectManagerEmail(entityType, baseModel);
      }
    }
  }

  private async handleFormSubmission(submission: FormSubmission) {
    await this.createAuditStatus();

    if (submission.status === "started") return;

    if (submission.status === "awaiting-approval") {
      if (submission.applicationId != null) {
        await Application.update({ updatedBy: authenticatedUserId() }, { where: { id: submission.applicationId } });
      }

      if (submission.projectPitchUuid != null) {
        await ProjectPitch.update({ status: "active" }, { where: { uuid: submission.projectPitchUuid } });
      }

      await this.sendApplicationSubmittedEmail(submission);
      return;
    }

    if (submission.status === "approved") {
      const stage =
        submission.stageUuid == null
          ? null
          : await submission.$get("stage", { attributes: ["order", "fundingProgrammeId"] });
      if (stage == null || (await stage.isFinalStage())) {
        // This will send the submission status email when complete.
        const { applicationId } = submission;
        await this.eventService.entitiesQueue.add("createProjectForApplication", { applicationId });
        return;
      }
    }

    await this.sendSubmissionStatusEmail(submission);
  }

  private async sendStatusUpdateEmail(type: EntityType, model: StatusUpdateModel = this.model) {
    this.logger.log(`Sending status update to email queue [${JSON.stringify({ type, id: model.id })}]`);
    await new EntityStatusUpdateEmail({ type, id: model.id }).sendLater(this.eventService.emailQueue);
  }

  private async sendProjectManagerEmail(type: EntityType, model: StatusUpdateModel = this.model) {
    this.logger.log(`Sending project manager email queue [${JSON.stringify({ type, id: model.id })}]`);
    await new ProjectManagerEmail({ type, id: model.id }).sendLater(this.eventService.emailQueue);
  }

  private async sendSubmissionStatusEmail(submission: FormSubmission) {
    this.logger.log(`Sending submission status email queue [${JSON.stringify({ id: submission.id })}]`);
    await new FormSubmissionFeedbackEmail({ submissionId: submission.id }).sendLater(this.eventService.emailQueue);
  }

  private async sendApplicationSubmittedEmail(submission: FormSubmission) {
    this.logger.log(`Sending application submitted email queue [${JSON.stringify({ id: submission.id })}]`);

    const userId = authenticatedUserId();
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
    }).sendLater(this.eventService.emailQueue);
  }

  private async updateActions() {
    this.logger.log(`Updating actions [${JSON.stringify({ model: this.model.constructor.name, id: this.model.id })}]`);
    const entity = this.model as EntityModel;
    await Action.for(entity).destroy({ where: { type: "notification" } });

    if (entity.status !== AWAITING_APPROVAL) {
      const action = new Action();
      action.status = "pending";
      action.targetableType = laravelType(entity);
      action.targetableId = entity.id;
      action.type = "notification";
      action.projectId = (await getProjectId(entity)) ?? null;
      action.organisationId = (await getOrganisationId(entity)) ?? null;

      if (!isReport(entity)) {
        action.title = get(entity, "name") ?? "";
        action.text = STATUS_DISPLAY_STRINGS[entity.status as AnyStatus];
      }

      await action.save();
    }

    // When project report is submitted or approved, create actions for pending site/nursery reports in the same task
    if (entity instanceof ProjectReport && (entity.status === AWAITING_APPROVAL || entity.status === APPROVED)) {
      await this.createActionsForPendingTaskReports(entity);
    }
  }

  /**
   * Creates actions for site and nursery reports in the same task that are still pending.
   * Called when project report is submitted so the frontend can show individual report cards.
   */
  private async createActionsForPendingTaskReports(projectReport: ProjectReport) {
    const { taskId } = projectReport;
    if (taskId == null) return;

    const task = await Task.findOne({
      where: { id: taskId },
      include: [
        { association: "siteReports", attributes: ["id", "status", "siteId"] },
        { association: "nurseryReports", attributes: ["id", "status", "nurseryId"] }
      ]
    });
    if (task == null) return;

    const pendingReports = [...(task.siteReports ?? []), ...(task.nurseryReports ?? [])].filter(
      report =>
        report != null && PENDING_REPORT_STATUSES.includes(report.status as (typeof PENDING_REPORT_STATUSES)[number])
    );

    for (const report of pendingReports) {
      const existingAction = await Action.findOne({
        where: {
          targetableType: laravelType(report),
          targetableId: report.id,
          type: "notification",
          status: "pending"
        }
      });
      if (existingAction != null) continue;

      const projectId = task.projectId ?? (await getProjectId(report)) ?? null;
      const organisationId = task.organisationId ?? (await getOrganisationId(report)) ?? null;

      const action = new Action();
      action.status = "pending";
      action.targetableType = laravelType(report);
      action.targetableId = report.id;
      action.type = "notification";
      action.projectId = projectId;
      action.organisationId = organisationId;
      await action.save();
    }
  }

  private async createAuditStatus(
    model: StatusUpdateModel = this.model,
    status = model.status,
    comment: string | null = null
  ) {
    const auditableType = laravelType(model);
    if (!AuditStatus.AUDITABLE_LARAVEL_TYPES.includes(auditableType)) return;

    this.logger.log(`Creating auditStatus [${JSON.stringify({ model: model.constructor.name, id: model.id })}]`);

    if (comment == null) {
      if (model instanceof FormSubmission) {
        if ([REJECTED, APPROVED, REQUIRES_MORE_INFORMATION].includes(status)) {
          comment = model.feedback ?? null;
        }
      } else if (status === APPROVED) {
        comment = `Approved: ${model.feedback}`;
      } else if (status === NEEDS_MORE_INFORMATION) {
        comment = await this.getNeedsMoreInfoComment();
      }
    }
    const type = status === NEEDS_MORE_INFORMATION ? "change-request" : "status";
    await AuditStatus.createAudit(model, authenticatedUserId(), type, comment);
  }

  private async getNeedsMoreInfoComment() {
    const { feedback, feedbackFields } = this.model;
    const labels = map(
      isEmpty(feedbackFields)
        ? []
        : await FormQuestion.findAll({
            where: { uuid: { [Op.in]: feedbackFields as string[] } },
            attributes: ["label"]
          }),
      "label"
    );
    return `Request More Information on the following fields: ${labels.join(", ")}. Feedback: ${
      feedback ?? "(No feedback)"
    }`;
  }

  private async checkTaskStatus(model: StatusUpdateModel = this.model) {
    if (!("taskId" in model)) {
      this.logger.log(`Skipping task status check for model without taskId [${model.constructor.name}, ${model.id}]`);
      return;
    }

    const modelWithTaskId = model as ReportModel & { taskId: number | null };
    const { taskId } = modelWithTaskId;
    if (taskId == null) {
      this.logger.warn(`No task found for status changed report [${model.constructor.name}, ${model.id}]`);
      return;
    }

    const attributes = ["id", "status", "updateRequestStatus"];
    const task = await Task.findOne({
      where: { id: taskId },
      include: [
        { association: "projectReport", attributes },
        { association: "siteReports", attributes },
        { association: "nurseryReports", attributes }
      ]
    });
    if (task == null) {
      this.logger.error(`No task found for task id [${taskId}]`);
      return;
    }

    if (task.status === DUE) {
      // No further processing needed; nothing automatic happens until the task has been submitted.
      return;
    }

    const reports = flatten<ReportModel | null>([task.projectReport, task.siteReports, task.nurseryReports]).filter(
      report => report != null
    );

    const reportStatuses = uniq(reports.map(({ status }) => status));
    if (reportStatuses.length === 1 && reportStatuses[0] === APPROVED) {
      await task.update({ status: APPROVED });
      return;
    }

    if (reportStatuses.includes(DUE) || reportStatuses.includes(STARTED)) {
      throw new InternalServerErrorException(`Task has unsubmitted reports [${taskId}]`);
    }

    const moreInfoReport = reports.find(
      ({ status, updateRequestStatus }) =>
        (status === NEEDS_MORE_INFORMATION && updateRequestStatus !== AWAITING_APPROVAL) ||
        updateRequestStatus === NEEDS_MORE_INFORMATION
    );
    if (moreInfoReport != null) {
      // A report in needs-more-information causes the task to go to needs-more-information
      await task.update({ status: NEEDS_MORE_INFORMATION });
      return;
    }

    // If there are no reports or update requests in needs-more-information, the only option left is that
    // something is in awaiting-approval.
    await task.update({ status: AWAITING_APPROVAL });
  }
}
