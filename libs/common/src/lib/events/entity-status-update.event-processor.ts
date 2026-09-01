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
  ProjectPitch,
  ProjectReport,
  SiteReport,
  Task,
  UpdateRequest,
  DisturbanceReport
} from "@terramatch-microservices/database/entities";
import { flatten, get, isEmpty, isEqual, map, uniq } from "lodash";
import { Op } from "sequelize";
import {
  AnyStatus,
  APPROVED,
  PENDING_APPROVAL,
  DUE,
  INFORMATION_REQUIRED,
  REJECTED,
  DRAFT,
  STATUS_DISPLAY_STRINGS
} from "@terramatch-microservices/database/constants/status";
import { LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { Model } from "sequelize-typescript";
import { getLinkedFieldConfig } from "../linkedFields";
import { isField, LinkedField } from "@terramatch-microservices/database/constants/linked-fields";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { APPROVAL_PROCESSERS, DisturbanceReportEntryApprovalProcessor } from "./processors";
import { LinkedAnswerCollector } from "../linkedFields/linkedAnswerCollector";
import { ApplicationSubmittedEmail } from "../email/application-submitted.email";
import { EntityStatusUpdateEmail } from "../email/entity-status-update.email";
import { ProjectManagerEmail } from "../email/project-manager.email";
import { FormSubmissionFeedbackEmail } from "../email/form-submission-feedback.email";
import { UserContext } from "../contexts/user.context";

const TASK_UPDATE_REPORT_STATUSES = [APPROVED, INFORMATION_REQUIRED, PENDING_APPROVAL];

const getEntityType = (model: Model) =>
  Object.entries(ENTITY_MODELS).find(([, entityClass]) => model instanceof entityClass)?.[0] as EntityType | undefined;

export class EntityStatusUpdate extends EventProcessor {
  private readonly logger = new TMLogger(EntityStatusUpdate.name);

  constructor(
    eventService: EventService,
    private readonly model: StatusUpdateModel
  ) {
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

      if (this.model.status === PENDING_APPROVAL) {
        await this.sendProjectManagerEmail(entityType);
      }

      if (
        this.model instanceof DisturbanceReport &&
        (this.model.status === PENDING_APPROVAL || this.model.status === INFORMATION_REQUIRED)
      ) {
        await DisturbanceReportEntryApprovalProcessor.processEntityApproval(this.model, this.eventService.mediaService);
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
    } else if (updateRequest.status === INFORMATION_REQUIRED) {
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

    if (updateRequest.status === PENDING_APPROVAL) {
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
            const updateRequestValue = updateRequest.content?.[question.formName];
            const baseValue = modelAnswers[question.formName];
            if (isEqual(updateRequestValue, baseValue)) return undefined;

            // We've already filtered the questions to only those with Field configs, so this cast is safe.
            return (getLinkedFieldConfig(question.linkedFieldKey ?? "")?.field as LinkedField).label;
          })
          .filter(isNotNull);
        await this.createAuditStatus(baseModel, PENDING_APPROVAL, `Pending Approval: ${labels.join(", ")}`);
        await this.sendProjectManagerEmail(entityType, baseModel);
      }
    }
  }

  private async handleFormSubmission(submission: FormSubmission) {
    await this.createAuditStatus();

    if (submission.status === "draft") return;

    if (submission.status === "pending-approval") {
      if (submission.applicationId != null) {
        await Application.update(
          { updatedBy: UserContext.authenticatedUserId },
          { where: { id: submission.applicationId } }
        );
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
    }).sendLater(this.eventService.emailQueue);
  }

  private async updateActions() {
    this.logger.log(`Updating actions [${JSON.stringify({ model: this.model.constructor.name, id: this.model.id })}]`);
    const entity = this.model as EntityModel;

    if (await this.canActionBeDeleted()) {
      await Action.for(entity).destroy({ where: { type: "notification" } });
    }

    if (entity.status !== PENDING_APPROVAL) {
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
        if ([REJECTED, APPROVED, INFORMATION_REQUIRED].includes(status)) {
          comment = model.feedback ?? null;
        }
      } else if (status === APPROVED) {
        comment = `Approved: ${model.feedback}`;
      } else if (status === INFORMATION_REQUIRED) {
        comment = await this.getNeedsMoreInfoComment();
      }
    }
    const type = status === INFORMATION_REQUIRED ? "change-request" : "status";
    await AuditStatus.createAudit(model, UserContext.authenticatedUserId, type, comment);
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

    const { taskId } = model as { taskId: number | null };
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
        { association: "nurseryReports", attributes },
        { association: "srpReports", attributes }
      ]
    });
    if (task == null) {
      this.logger.error(`No task found for task id [${taskId}]`);
      return;
    }

    const reports = flatten<ReportModel | null>([
      task.projectReport,
      task.siteReports,
      task.nurseryReports,
      task.srpReports
    ]).filter(isNotNull);

    const reportStatuses = uniq(reports.map(({ status }) => status));
    if (reportStatuses.length === 1 && reportStatuses[0] === APPROVED) {
      await task.update({ status: APPROVED });
      return;
    }

    if (reportStatuses.includes(DUE) || reportStatuses.includes(DRAFT)) {
      return; // NOOP
    }

    const moreInfoReport = reports.find(
      ({ status, updateRequestStatus }) =>
        (status === INFORMATION_REQUIRED && updateRequestStatus !== PENDING_APPROVAL) ||
        updateRequestStatus === INFORMATION_REQUIRED
    );
    if (moreInfoReport != null) {
      // A report in information-required causes the task to go to information-required
      await task.update({ status: INFORMATION_REQUIRED });
      return;
    }

    // At this point, there are no reports in due, draft or information-required, but they're
    // not all approved, so at least one report is in pending-approval.
    await task.update({ status: PENDING_APPROVAL });
  }

  private async canActionBeDeleted() {
    if (
      this.model instanceof ProjectReport ||
      this.model instanceof SiteReport ||
      this.model instanceof NurseryReport
    ) {
      if (this.model.taskId == null) {
        this.logger.error(`No taskId found for report [${this.model.constructor.name}, ${this.model.id}]`);
        return false;
      }
      const task = await Task.findOne({
        where: { id: this.model.taskId },
        include: [
          {
            association: "projectReport",
            attributes: ["id", "status"],
            where: { status: { [Op.notIn]: [DUE, INFORMATION_REQUIRED] } }
          },
          {
            association: "siteReports",
            attributes: ["id", "status"],
            where: { status: { [Op.notIn]: [DUE, INFORMATION_REQUIRED] } }
          },
          {
            association: "nurseryReports",
            attributes: ["id", "status"],
            where: { status: { [Op.notIn]: [DUE, INFORMATION_REQUIRED] } }
          }
        ]
      });
      if (task == null) {
        this.logger.error(`No task found for report [${this.model.constructor.name}, ${this.model.id}]`);
        return false;
      }
      if (task.projectReport == null && task.siteReports?.length === 0 && task.nurseryReports?.length === 0) {
        return false;
      }
    }
    return true;
  }
}
