import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { AuditStatusService } from "./audit-status.service";
import { AuditStatusParamsDto } from "./dto/audit-status-params.dto";
import { AuditStatusDto } from "./dto/audit-status.dto";

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
    const baseEntity = await this.auditStatusService.resolveEntity(entity, uuid);
    await this.policyService.authorize("read", baseEntity);
    const auditStatuses = await this.auditStatusService.getAuditStatuses(baseEntity, entity, uuid);
    const document = buildJsonApi(AuditStatusDto, { forceDataArray: true });
    for (const auditStatus of auditStatuses) {
      document.addData(auditStatus.uuid, auditStatus);
    }

    return document;
  }
}
