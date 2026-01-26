import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { AuditStatusService } from "./audit-status.service";
import { AuditStatusParamsDto } from "./dto/audit-status-params.dto";
import { AuditStatusDto } from "./dto/audit-status.dto";
import { ENTITY_MODELS, EntityType } from "@terramatch-microservices/database/constants/entities";
import { SitePolygon } from "@terramatch-microservices/database/entities/site-polygon.entity";
import { LaravelModel } from "@terramatch-microservices/database/types/util";

@Controller("entities/v3/auditStatuses")
export class AuditStatusController {
  constructor(private readonly auditStatusService: AuditStatusService, private readonly policyService: PolicyService) {}

  @Get(":entity/:uuid")
  @ApiOperation({
    operationId: "getAuditStatuses",
    summary: "Get audit status history for an entity"
  })
  @JsonApiResponse({ data: AuditStatusDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  async getAuditStatuses(@Param() { entity, uuid }: AuditStatusParamsDto) {
    let baseEntity: LaravelModel | null = null;
    if (entity === "sitePolygons") {
      baseEntity = await SitePolygon.findOne({
        where: { uuid },
        attributes: ["id", "uuid"]
      });
    } else {
      const entityModelClass = ENTITY_MODELS[entity as EntityType];
      if (entityModelClass == null) {
        throw new NotFoundException(`Entity type not found: ${entity}`);
      }
      baseEntity = await entityModelClass.findOne({
        where: { uuid },
        attributes: ["id", "uuid"]
      });
    }

    if (baseEntity == null) {
      throw new NotFoundException(`Entity not found: [${entity}, ${uuid}]`);
    }

    await this.policyService.authorize("read", baseEntity);

    const auditStatuses = await this.auditStatusService.getAuditStatuses(entity, uuid);
    const document = buildJsonApi(AuditStatusDto, { forceDataArray: true });
    for (const auditStatus of auditStatuses) {
      document.addData(auditStatus.uuid, auditStatus);
    }

    return document;
  }
}
