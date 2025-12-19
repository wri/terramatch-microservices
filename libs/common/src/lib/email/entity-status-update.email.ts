/* istanbul ignore file */
import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { SpecificEntityData } from "./email.processor";
import {
  ENTITY_MODELS,
  EntityModel,
  getProjectId,
  getViewLinkPath,
  isReport,
  ReportModel
} from "@terramatch-microservices/database/constants/entities";
import { Dictionary, groupBy, isEmpty } from "lodash";
import {
  DisturbanceReport,
  FinancialReport,
  ProjectReport,
  ProjectUser,
  SiteReport,
  SrpReport,
  UpdateRequest,
  User
} from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { TMLogger } from "../util/tm-logger";
import { InternalServerErrorException } from "@nestjs/common";
import { APPROVED, NEEDS_MORE_INFORMATION } from "@terramatch-microservices/database/constants/status";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

export class EntityStatusUpdateEmail extends EmailSender<SpecificEntityData> {
  static readonly NAME = "entityStatusUpdate";

  private readonly logger = new TMLogger(EntityStatusUpdateEmail.name);

  constructor(data: SpecificEntityData) {
    super(EntityStatusUpdateEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const entity = await this.getEntity();
    const status =
      entity.status === NEEDS_MORE_INFORMATION || entity.updateRequestStatus === NEEDS_MORE_INFORMATION
        ? NEEDS_MORE_INFORMATION
        : entity.status;
    if (![APPROVED, NEEDS_MORE_INFORMATION].includes(status)) return;

    const logExtras = `[type=${this.data.type}, id=${this.data.id}, status=${status}]` as const;
    this.logger.log(`Sending status update email ${logExtras}`);

    const to = emailService.filterEntityEmailRecipients(await this.getEntityUsers(entity));
    if (isEmpty(to)) {
      this.logger.debug(`No addresses found to send entity update to ${logExtras}`);
      return;
    }

    const i18nKeys: Dictionary<string> = {
      subject:
        status === APPROVED
          ? "entity-status-change.subject-approved"
          : "entity-status-change.subject-needs-more-information",
      cta: "entity-status-change.cta"
    };
    i18nKeys["title"] = i18nKeys["subject"];

    if (isReport(entity)) {
      i18nKeys["body"] =
        status === APPROVED
          ? "entity-status-change.body-report-approved"
          : "entity-status-change.body-report-needs-more-information";
    } else {
      i18nKeys["body"] =
        status === APPROVED
          ? "entity-status-change.body-entity-approved"
          : "entity-status-change.body-entity-needs-more-information";
    }

    const entityTypeName = isReport(entity) ? "Report" : entity.constructor.name;
    const feedback = await this.getFeedback(entity);
    const i18nReplacements: Dictionary<string> = {
      "{entityTypeName}": entityTypeName,
      "{lowerEntityTypeName}": entityTypeName.toLowerCase(),
      "{entityName}": (isReport(entity) ? "" : entity.name) ?? "",
      "{feedback}": feedback == null || feedback === "" ? "(No feedback)" : feedback
    };
    if (isReport(entity)) i18nReplacements["{parentEntityName}"] = this.getParentName(entity) ?? "";

    const additionalValues = {
      link: getViewLinkPath(entity),
      transactional: "transactional"
    };

    // Group the users by locale and then send the email to each locale group.
    await Promise.all(
      Object.entries(groupBy(to, "locale")).map(([locale, users]) =>
        emailService.sendI18nTemplateEmail(
          users.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          i18nKeys,
          {
            i18nReplacements,
            additionalValues
          }
        )
      )
    );
  }

  private getParentName(report: ReportModel) {
    if (report instanceof ProjectReport) return report.projectName;
    if (report instanceof SiteReport) return report.siteName;
    if (report instanceof FinancialReport) return report.organisationName;
    if (report instanceof DisturbanceReport) return report.projectName;
    if (report instanceof SrpReport) return report.projectName;
    return report.nurseryName;
  }

  private async getFeedback(entity: EntityModel) {
    if (![APPROVED, NEEDS_MORE_INFORMATION].includes(entity.updateRequestStatus ?? "")) {
      return entity.feedback;
    }

    const updateRequest = await UpdateRequest.for(entity).findOne({
      order: [["updatedAt", "DESC"]],
      attributes: ["feedback"]
    });
    return updateRequest?.feedback ?? entity.feedback;
  }

  private async getEntity() {
    const entityClass = ENTITY_MODELS[this.data.type];
    if (entityClass == null) {
      throw new InternalServerErrorException(`Entity model class not found for entity type [${this.data.type}]`);
    }

    const include: Includeable[] = [];
    const attributeKeys = Object.keys(entityClass.getAttributes());

    const attributes = ["id", "uuid", "status", "updateRequestStatus", "name", "feedback", "createdBy"].filter(field =>
      attributeKeys.includes(field)
    );

    for (const parentId of ["projectId", "siteId", "nurseryId"]) {
      if (attributeKeys.includes(parentId)) {
        attributes.push(parentId);
        include.push({ association: parentId.substring(0, parentId.length - 2), attributes: ["name"] });
      }
    }
    const entity = await entityClass.findOne({ where: { id: this.data.id }, attributes, include });
    if (entity == null) {
      throw new InternalServerErrorException(
        `Entity instance not found for id [type=${this.data.type}, id=${this.data.id}]`
      );
    }

    return entity;
  }

  private async getEntityUsers(entity: EntityModel) {
    // FinancialReport does not have a projectId, so we send email to the createdBy user
    if (entity instanceof FinancialReport) {
      const user =
        entity.createdBy == null
          ? undefined
          : await User.findByPk(entity.createdBy, {
              attributes: ["emailAddress", "locale"]
            });
      return user != null ? [user] : [];
    }

    const projectId = await getProjectId(entity);
    if (projectId == null) {
      this.logger.error(`Could not find project ID for entity [type=${entity.constructor.name}, id=${entity.id}]`);
      return [];
    }

    return await User.findAll({
      where: { id: { [Op.in]: ProjectUser.projectUsersSubquery(projectId) } },
      attributes: ["emailAddress", "locale"]
    });
  }
}
