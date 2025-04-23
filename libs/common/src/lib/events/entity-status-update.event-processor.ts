import { FeedbackModel, LaravelModel, laravelType, StatusModel } from "@terramatch-microservices/database/types/util";
import { EventProcessor } from "./event.processor";
import { TMLogger } from "../util/tm-logger";
import {
  ENTITY_MODELS,
  EntityModel,
  EntityType,
  getOrganisationId,
  getProjectId,
  isReport
} from "@terramatch-microservices/database/constants/entities";
import { StatusUpdateData } from "../email/email.processor";
import { EventService } from "./event.service";
import { Action, AuditStatus, FormQuestion } from "@terramatch-microservices/database/entities";
import { get, isEmpty, map } from "lodash";
import { Op } from "sequelize";
import { STATUS_DISPLAY_STRINGS } from "@terramatch-microservices/database/constants/status";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";

export type StatusUpdateModel = LaravelModel & StatusModel & FeedbackModel;

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

    const entityType = Object.entries(ENTITY_MODELS).find(
      ([, entityClass]) => this.model instanceof entityClass
    )?.[0] as EntityType | undefined;

    if (entityType != null) {
      await this.sendStatusUpdateEmail(entityType);
      await this.updateActions();
    }
    await this.createAuditStatus();
  }

  private async sendStatusUpdateEmail(type: EntityType) {
    this.logger.log(`Sending status update to email queue [${JSON.stringify({ type, id: this.model.id })}]`);
    await this.eventService.emailQueue.add("statusUpdate", { type, id: this.model.id } as StatusUpdateData);
  }

  private async updateActions() {
    this.logger.log(`Updating actions [${JSON.stringify({ model: this.model.constructor.name, id: this.model.id })}]`);
    const entity = this.model as EntityModel;

    if (entity instanceof Disturbance) return;

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
    this.logger.log(
      `Creating auditStatus [${JSON.stringify({ model: this.model.constructor.name, id: this.model.id })}]`
    );

    const user = await this.getAuthenticatedUser();
    const auditStatus = new AuditStatus();
    auditStatus.auditableType = laravelType(this.model);
    auditStatus.auditableId = this.model.id;
    auditStatus.createdBy = user?.emailAddress ?? null;
    auditStatus.firstName = user?.firstName ?? null;
    auditStatus.lastName = user?.lastName ?? null;

    // TODO: the update is different for UpdateRequest awaiting approval
    if (this.model.status === "approved") {
      auditStatus.comment = `Approved: ${this.model.feedback}`;
    } else if (this.model.status === "restoration-in-progress") {
      auditStatus.comment = "Restoration In Progress";
    } else if (this.model.status === "needs-more-information") {
      auditStatus.type = "change-request";
      auditStatus.comment = await this.getNeedsMoreInfoComment();
    } else if (this.model.status === "awaiting-approval") {
      // NOOP, but avoid the short circuit warning below.
    } else {
      this.logger.warn(
        `Skipping audit status for entity status [${JSON.stringify({
          model: this.model.constructor.name,
          id: this.model.id,
          status: this.model.status
        })}]`
      );
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
}
