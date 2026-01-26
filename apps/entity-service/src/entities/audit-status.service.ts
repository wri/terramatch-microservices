import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { Audit } from "@terramatch-microservices/database/entities/audit.entity";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { SitePolygon } from "@terramatch-microservices/database/entities/site-polygon.entity";
import { EntityType, ENTITY_MODELS } from "@terramatch-microservices/database/constants/entities";
import { AuditStatusDto } from "./dto/audit-status.dto";
import { EntitiesService } from "./entities.service";
import { Op } from "sequelize";
import { orderBy, uniqBy } from "lodash";
import { LaravelModel } from "@terramatch-microservices/database/types/util";

@Injectable()
export class AuditStatusService {
  constructor(private readonly entitiesService: EntitiesService) {}

  async resolveEntity(entityType: EntityType | "sitePolygons", entityUuid: string): Promise<LaravelModel> {
    let entity: LaravelModel | null;
    if (entityType === "sitePolygons") {
      entity = await SitePolygon.findOne({
        where: { uuid: entityUuid },
        attributes: ["id", "uuid"]
      });
    } else {
      const entityModelClass = ENTITY_MODELS[entityType];
      if (entityModelClass == null) {
        throw new NotFoundException(`Entity type not found: ${entityType}`);
      }
      entity = await entityModelClass.findOne({
        where: { uuid: entityUuid },
        attributes: ["id", "uuid"]
      });
    }
    if (entity == null) {
      throw new NotFoundException(`Entity not found: [${entityType}, ${entityUuid}]`);
    }
    return entity;
  }

  async getAuditStatuses(
    entity: LaravelModel,
    entityType: EntityType | "sitePolygons",
    entityUuid: string
  ): Promise<AuditStatusDto[]> {
    const modernAuditStatuses = await AuditStatus.for(entity).findAll({
      order: [
        ["updatedAt", "DESC"],
        ["createdAt", "DESC"]
      ]
    });

    const legacyCutoffDate = new Date("2024-09-01");
    const legacyAudits = await Audit.for(entity).findAll({
      where: {
        [Op.or]: [{ createdAt: { [Op.lt]: legacyCutoffDate } }, { updatedAt: { [Op.lt]: legacyCutoffDate } }]
      },
      order: [
        ["updatedAt", "DESC"],
        ["createdAt", "DESC"]
      ]
    });

    const auditStatusWithAttachments = await Promise.all(
      modernAuditStatuses.map(async auditStatus => {
        const attachments = await Media.for(auditStatus).collection("attachments").findAll();
        const attachmentDtos = attachments.map(media =>
          this.entitiesService.mediaDto(media, { entityType, entityUuid } as {
            entityType: EntityType;
            entityUuid: string;
          })
        );

        return { auditStatus, attachments: attachmentDtos };
      })
    );

    const userIds = legacyAudits.map(audit => audit.userId).filter((id): id is number => id != null);
    const uniqueUserIds = [...new Set(userIds)];

    const users =
      uniqueUserIds.length > 0
        ? await User.findAll({
            where: { id: { [Op.in]: uniqueUserIds } },
            attributes: ["id", "firstName", "lastName"]
          })
        : [];

    const userMap = new Map(users.map(user => [user.id, user]));

    const modernDtos = auditStatusWithAttachments.map(({ auditStatus, attachments }) =>
      AuditStatusDto.fromAuditStatus(auditStatus, attachments)
    );

    const legacyDtos = legacyAudits.map(audit => {
      const user = audit.userId != null ? userMap.get(audit.userId) : null;
      return AuditStatusDto.fromAudits(audit, user?.firstName ?? null, user?.lastName ?? null);
    });

    const allDtos = orderBy(
      [...modernDtos, ...legacyDtos],
      dto => (dto.dateCreated != null ? new Date(dto.dateCreated).getTime() : 0),
      "desc"
    );

    // Match V2 behavior unique('comment')
    const uniqueDtos = uniqBy(allDtos, dto => dto.comment ?? null);

    return uniqueDtos;
  }
}
