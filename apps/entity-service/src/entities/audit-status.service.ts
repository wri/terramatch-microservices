import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { Audit } from "@terramatch-microservices/database/entities/audit.entity";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { SitePolygon } from "@terramatch-microservices/database/entities/site-polygon.entity";
import { EntityType, ENTITY_MODELS, isReport } from "@terramatch-microservices/database/constants/entities";
import {
  POLYGON_DATA_SUBMISSION_AUDIT_TYPE,
  READY_FOR_BASELINE_AUDIT_TYPE
} from "@terramatch-microservices/database/constants/audit-status";
import {
  ENTITY_STATUSES,
  EntityStatus,
  REPORT_STATUSES,
  ReportStatus
} from "@terramatch-microservices/database/constants/status";
import { AuditStatusDto } from "./dto/audit-status.dto";
import { EntitiesService } from "./entities.service";
import { Op } from "sequelize";
import { orderBy, uniqBy } from "lodash";
import { LaravelModel, laravelType } from "@terramatch-microservices/database/types/util";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { InferCreationAttributes } from "sequelize";
import { ModelCtor } from "sequelize-typescript";

interface RawAuditData {
  modernAuditStatuses: AuditStatus[];
  legacyAudits: Audit[];
}

@Injectable()
export class AuditStatusService {
  constructor(private readonly entitiesService: EntitiesService) {}

  async resolveEntity(entityType: EntityType | "sitePolygons", entityUuid: string): Promise<LaravelModel> {
    let entity: LaravelModel | null;
    if (entityType === "sitePolygons") {
      entity = await SitePolygon.findOne({
        where: { uuid: entityUuid }
      });
    } else {
      const entityModelClass = ENTITY_MODELS[entityType];
      if (entityModelClass == null) {
        throw new NotFoundException(`Entity type not found: ${entityType}`);
      }
      entity = await entityModelClass.findOne({
        where: { uuid: entityUuid }
      });
    }
    if (entity == null) {
      throw new NotFoundException(`Entity not found: [${entityType}, ${entityUuid}]`);
    }
    return entity;
  }

  private async queryAuditData(entities: LaravelModel[], typeFilter?: string[]): Promise<RawAuditData> {
    if (entities.length === 0) {
      return { modernAuditStatuses: [], legacyAudits: [] };
    }

    const typeWhere = typeFilter != null && typeFilter.length > 0 ? { type: { [Op.in]: typeFilter } } : undefined;

    const modernAuditStatuses = await AuditStatus.for(entities).findAll({
      ...(typeWhere != null ? { where: typeWhere } : {}),
      order: [
        ["updatedAt", "DESC"],
        ["createdAt", "DESC"]
      ]
    });

    const legacyCutoffDate = new Date("2024-09-01");
    const legacyAudits =
      typeFilter != null && typeFilter.length > 0
        ? []
        : await Audit.for(entities).findAll({
            where: {
              [Op.or]: [{ createdAt: { [Op.lt]: legacyCutoffDate } }, { updatedAt: { [Op.lt]: legacyCutoffDate } }]
            },
            order: [
              ["updatedAt", "DESC"],
              ["createdAt", "DESC"]
            ]
          });

    return { modernAuditStatuses, legacyAudits };
  }

  private async loadMediaAttachments(
    auditStatuses: AuditStatus[],
    entityType: EntityType | "sitePolygons" | "submissions",
    entityUuid: string
  ): Promise<Map<number, MediaDto[]>> {
    const attachmentsMap = new Map<number, MediaDto[]>();

    await Promise.all(
      auditStatuses.map(async auditStatus => {
        const attachments = await Media.for(auditStatus).collection("attachments").findAll();
        const attachmentDtos = attachments.map(media =>
          this.entitiesService.mediaDto(media, { entityType, entityUuid } as {
            entityType: EntityType;
            entityUuid: string;
          })
        );
        attachmentsMap.set(auditStatus.id, attachmentDtos);
      })
    );

    return attachmentsMap;
  }

  private async transformToDtos(
    data: RawAuditData,
    attachmentsMap?: Map<number, MediaDto[]>
  ): Promise<AuditStatusDto[]> {
    const userIds = data.legacyAudits.map(audit => audit.userId).filter((id): id is number => id != null);
    const uniqueUserIds = [...new Set(userIds)];

    const users =
      uniqueUserIds.length > 0
        ? await User.findAll({
            where: { id: { [Op.in]: uniqueUserIds } },
            attributes: ["id", "firstName", "lastName"]
          })
        : [];

    const userMap = new Map(users.map(user => [user.id, user]));

    const modernDtos = data.modernAuditStatuses.map(auditStatus => {
      const attachments = attachmentsMap?.get(auditStatus.id) ?? [];
      return AuditStatusDto.fromAuditStatus(auditStatus, attachments);
    });

    const legacyDtos = data.legacyAudits.map(audit => {
      const user = audit.userId != null ? userMap.get(audit.userId) : null;
      return AuditStatusDto.fromAudits(
        audit,
        user != null ? user.firstName : null,
        user != null ? user.lastName : null
      );
    });

    return orderBy(
      [...modernDtos, ...legacyDtos],
      dto => (dto.dateCreated != null ? new Date(dto.dateCreated).getTime() : 0),
      "desc"
    );
  }

  async getAuditStatuses(
    entity: LaravelModel,
    entityType: EntityType | "sitePolygons" | "submissions",
    entityUuid: string,
    typeFilter?: string[]
  ): Promise<AuditStatusDto[]> {
    const data = await this.queryAuditData([entity], typeFilter);
    const attachmentsMap = await this.loadMediaAttachments(data.modernAuditStatuses, entityType, entityUuid);
    const dtos = await this.transformToDtos(data, attachmentsMap);
    if (typeFilter != null && typeFilter.length > 0) {
      return uniqBy(dtos, dto => dto.uuid);
    }
    return uniqBy(dtos, dto => dto.comment ?? "__NULL_COMMENT_KEY__");
  }

  private shouldSyncModelStatusFromAudit(
    entity: LaravelModel,
    attributes: {
      type?: string | null;
      status?: string | null;
    }
  ): boolean {
    if (attributes.type === "change-request" || attributes.status == null) {
      return false;
    }
    const modelClass = entity.constructor as ModelCtor<LaravelModel>;
    if (!("status" in modelClass.getAttributes())) {
      return false;
    }
    if (entity instanceof SitePolygon) {
      return attributes.type === "status";
    }
    if (attributes.type === POLYGON_DATA_SUBMISSION_AUDIT_TYPE || attributes.type === READY_FOR_BASELINE_AUDIT_TYPE) {
      return false;
    }
    if (isReport(entity)) {
      return REPORT_STATUSES.includes(attributes.status as ReportStatus);
    }
    return ENTITY_STATUSES.includes(attributes.status as EntityStatus);
  }

  async createAuditStatus(
    entity: LaravelModel,
    attributes: {
      type?: string | null;
      comment?: string | null;
      status?: string | null;
      isActive?: boolean | null;
      requestRemoved?: boolean | null;
    }
  ): Promise<AuditStatus> {
    const userId = this.entitiesService.userId;
    if (userId == null) {
      throw new NotFoundException("Authenticated user not found");
    }

    const user = await User.findByPk(userId, {
      attributes: ["emailAddress", "firstName", "lastName"]
    });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const auditableType = laravelType(entity);
    const auditableId = entity.id;

    if (attributes.type === "change-request") {
      await AuditStatus.update(
        { isActive: false },
        {
          where: {
            auditableType,
            auditableId,
            type: "change-request",
            isActive: true
          }
        }
      );
    }

    const auditStatus = await AuditStatus.create({
      auditableType,
      auditableId,
      status: attributes.status ?? null,
      comment: attributes.comment ?? null,
      type: attributes.type ?? null,
      isActive: attributes.type === "change-request" ? (attributes.isActive ?? null) : null,
      requestRemoved: attributes.type === "change-request" ? (attributes.requestRemoved ?? null) : null,
      createdBy: user.emailAddress, // this is storing the email of the user, not the ID
      firstName: user.firstName,
      lastName: user.lastName
    } as InferCreationAttributes<AuditStatus>);

    if (this.shouldSyncModelStatusFromAudit(entity, attributes)) {
      const modelClass = entity.constructor as ModelCtor<LaravelModel>;
      await modelClass.update({ status: attributes.status }, { where: { id: entity.id } });
    }

    return auditStatus;
  }

  async deleteAuditStatus(auditUuid: string): Promise<void> {
    const auditStatus = await AuditStatus.findOne({
      where: {
        uuid: auditUuid
      }
    });

    if (auditStatus == null) {
      throw new NotFoundException(`Audit status not found`);
    }

    await auditStatus.destroy();
  }
}
