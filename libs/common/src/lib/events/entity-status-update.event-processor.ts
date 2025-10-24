import { laravelType, StatusUpdateModel } from "@terramatch-microservices/database/types/util";
import { EventProcessor } from "./event.processor";
import { TMLogger } from "../util/tm-logger";
import {
  ENTITY_MODELS,
  EntityModel,
  EntityType,
  getOrganisationId,
  getProjectId,
  isReport,
  ReportModel
} from "@terramatch-microservices/database/constants/entities";
import { StatusUpdateData } from "../email/email.processor";
import { EventService } from "./event.service";
import { Action, AuditStatus, FormQuestion, Task } from "@terramatch-microservices/database/entities";
import { flatten, get, isEmpty, map, uniq } from "lodash";
import { Op } from "sequelize";
import {
  APPROVED,
  AWAITING_APPROVAL,
  DUE,
  NEEDS_MORE_INFORMATION,
  STARTED,
  STATUS_DISPLAY_STRINGS
} from "@terramatch-microservices/database/constants/status";
import { InternalServerErrorException } from "@nestjs/common";

const TASK_UPDATE_REPORT_STATUSES = [APPROVED, NEEDS_MORE_INFORMATION, AWAITING_APPROVAL];

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

    const entityType = Object.entries(ENTITY_MODELS).find(
      ([, entityClass]) => this.model instanceof entityClass
    )?.[0] as EntityType | undefined;

    if (entityType != null) {
      await this.sendStatusUpdateEmail(entityType);
      await this.updateActions();
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

  private async sendStatusUpdateEmail(type: EntityType) {
    this.logger.log(`Sending status update to email queue [${JSON.stringify({ type, id: this.model.id })}]`);
    await this.eventService.emailQueue.add("statusUpdate", { type, id: this.model.id } as StatusUpdateData);
  }

  private async updateActions() {
    this.logger.log(`Updating actions [${JSON.stringify({ model: this.model.constructor.name, id: this.model.id })}]`);
    const entity = this.model as EntityModel;
    await Action.for(entity).destroy({ where: { type: "notification" } });

    if (entity.status !== "awaiting-approval") {
      const action = new Action();
      action.status = "pending";
      action.targetableType = laravelType(entity);
      action.targetableId = entity.id;
      action.type = "notification";
      action.projectId = (await getProjectId(entity)) ?? null;
      action.organisationId = (await getOrganisationId(entity)) ?? null;

      if (!isReport(entity)) {
        action.title = get(entity, "name") ?? "";
        action.text = STATUS_DISPLAY_STRINGS[entity.status];
      }

      await action.save();
    }
  }

  private async createAuditStatus() {
    const auditableType = laravelType(this.model);
    if (!AuditStatus.AUDITABLE_LARAVEL_TYPES.includes(auditableType)) return;

    this.logger.log(
      `Creating auditStatus [${JSON.stringify({ model: this.model.constructor.name, id: this.model.id })}]`
    );

    const user = await this.getAuthenticatedUser();
    const auditStatus = new AuditStatus();
    auditStatus.auditableType = auditableType;
    auditStatus.auditableId = this.model.id;
    auditStatus.createdBy = user?.emailAddress ?? null;
    auditStatus.firstName = user?.firstName ?? null;
    auditStatus.lastName = user?.lastName ?? null;

    // TODO: the update is different for UpdateRequest awaiting approval
    if (this.model.status === "approved") {
      auditStatus.comment = `Approved: ${this.model.feedback}`;
    } else if (this.model.status === "needs-more-information") {
      auditStatus.type = "change-request";
      auditStatus.comment = await this.getNeedsMoreInfoComment();
    } else if (this.model.status === "awaiting-approval") {
      // no additional properties to set, but avoid the short circuit warning below.
    } else {
      // Getting this method called for started is expected on model creation, so no need to warn
      // in that case.
      if (this.model.status !== "started") {
        this.logger.warn(
          `Skipping audit status for entity status [${JSON.stringify({
            model: this.model.constructor.name,
            id: this.model.id,
            status: this.model.status
          })}]`
        );
      }
      return;
    }

    await auditStatus.save();
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

  private async checkTaskStatus() {
    if (!("taskId" in this.model)) {
      this.logger.warn(
        `Skipping task status check for model without taskId [${this.model.constructor.name}, ${this.model.id}]`
      );
      return;
    }
    // Special case for financial report: it has no taskId
    const modelWithTaskId = this.model as ReportModel & { taskId: number | null };
    const { taskId } = modelWithTaskId;

    if (taskId == null) {
      this.logger.warn(`No task found for status changed report [${this.model.constructor.name}, ${this.model.id}]`);
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
